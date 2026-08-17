'use server'

import { del } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import { db } from '../db'
import { documentSchema, fieldErrors } from '../validation'
import { THIRD_PARTY_CERTIFICATE, type OwnerType } from '../enums'

/**
 * `values` echoes the submitted form back on failure. React resets a form once
 * its action resolves, so without this the user loses everything they typed
 * the moment one field fails validation.
 */
export type ActionState = {
  errors?: Record<string, string>
  ok?: boolean
  values?: DocumentFormValues
}

export type DocumentFormValues = ReturnType<typeof readDocumentForm>

/** Owner type maps to one of the three nullable FKs on Document. */
const OWNER_FK: Record<OwnerType, 'customerId' | 'equipmentId' | 'operatorId'> = {
  CUSTOMER: 'customerId',
  EQUIPMENT: 'equipmentId',
  OPERATOR: 'operatorId',
}

const OWNER_PATH: Record<OwnerType, string> = {
  CUSTOMER: 'customers',
  EQUIPMENT: 'equipment',
  OPERATOR: 'operators',
}

function readDocumentForm(formData: FormData) {
  const ownerType = String(formData.get('ownerType') ?? '')
  const documentType = String(formData.get('documentType') ?? '')
  const isThirdParty = documentType === THIRD_PARTY_CERTIFICATE
  const isOperatorThirdParty = ownerType === 'OPERATOR' && isThirdParty

  return {
    ownerType,
    ownerId: String(formData.get('ownerId') ?? ''),
    documentType,
    documentNumber: String(formData.get('documentNumber') ?? ''),
    issueDate: String(formData.get('issueDate') ?? ''),
    expiryDate: String(formData.get('expiryDate') ?? ''),
    isApplicable: formData.get('isApplicable') !== null,
    // Drop any stale 3rd party values if the type was switched away before
    // submitting, so a non-certificate never carries certificate fields.
    thirdPartyType: isThirdParty ? String(formData.get('thirdPartyType') ?? '') : '',
    issuingCompany: isThirdParty ? String(formData.get('issuingCompany') ?? '') : '',
    // Machine type only means something on an operator's 3rd party
    // certificate — dropped otherwise, same reasoning as thirdPartyType.
    certifiedEquipmentType: isOperatorThirdParty
      ? String(formData.get('certifiedEquipmentType') ?? '')
      : '',
    approvedFor: isThirdParty
      ? formData.getAll('approvedFor').map((value) => String(value))
      : [],
    // Set by DocumentForm once the file has finished uploading directly to
    // Blob — this action never sees the file bytes themselves.
    fileUrl: String(formData.get('fileUrl') ?? ''),
    fileName: String(formData.get('fileName') ?? ''),
    fileType: String(formData.get('fileType') ?? ''),
    // Only meaningful when the type is Other — dropped otherwise.
    otherLabel:
      documentType === 'Other' ? String(formData.get('otherLabel') ?? '') : '',
    // Every owner type, every document type.
    notes: String(formData.get('notes') ?? ''),
  }
}

/**
 * Best-effort. An orphaned blob costs storage, not correctness, so a delete
 * failure here must never fail the save or delete that already succeeded in
 * the database.
 */
async function deleteBlob(url: string | null | undefined) {
  if (!url) return

  try {
    await del(url)
  } catch {
    // Already gone, or Blob is unreachable — nothing to do about it here.
  }
}

export async function createDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readDocumentForm(formData)
  const parsed = documentSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const { ownerType, ownerId, approvedFor, ...fields } = parsed.data

  await db.document.create({
    data: {
      ...fields,
      ownerType,
      [OWNER_FK[ownerType]]: ownerId,
      approvedFor: { create: approvedFor.map((body) => ({ body })) },
    },
  })

  revalidatePath(`/${OWNER_PATH[ownerType]}/${ownerId}`)
  revalidatePath(`/${OWNER_PATH[ownerType]}`)
  return { ok: true }
}

export async function updateDocument(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readDocumentForm(formData)
  const parsed = documentSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const { ownerType, ownerId, approvedFor, ...fields } = parsed.data

  // Read before the write so a changed or cleared file has an old URL to
  // clean up afterward — once the update below lands, the row no longer
  // points at it and it would otherwise sit in Blob storage forever.
  const existing = await db.document.findUnique({
    where: { id },
    select: { fileUrl: true },
  })

  // Approval bodies are a join table, so the set is replaced rather than
  // diffed. This is a NESTED write, not an explicit $transaction: Prisma runs
  // the delete and the inserts in one atomic statement batch, so there is no
  // separate transaction to acquire.
  //
  // That matters on Neon. Its pooled connection plus a cold start regularly
  // pushed $transaction past its start timeout, and saving a document failed
  // with "Unable to start a transaction in the given time".
  await db.document.update({
    where: { id },
    data: {
      ...fields,
      approvedFor: {
        deleteMany: {},
        create: approvedFor.map((body) => ({ body })),
      },
    },
  })

  if (existing?.fileUrl && existing.fileUrl !== fields.fileUrl) {
    await deleteBlob(existing.fileUrl)
  }

  revalidatePath(`/${OWNER_PATH[ownerType]}/${ownerId}`)
  revalidatePath(`/${OWNER_PATH[ownerType]}`)
  return { ok: true }
}

export async function deleteDocument(id: string) {
  const document = await db.document.findUnique({ where: { id } })
  if (!document) return

  await db.document.delete({ where: { id } })
  await deleteBlob(document.fileUrl)

  const ownerType = document.ownerType as OwnerType
  const ownerId =
    document.customerId ?? document.equipmentId ?? document.operatorId

  revalidatePath(`/${OWNER_PATH[ownerType]}/${ownerId}`)
  revalidatePath(`/${OWNER_PATH[ownerType]}`)
}
