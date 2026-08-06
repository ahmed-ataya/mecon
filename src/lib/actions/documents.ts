'use server'

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
  const documentType = String(formData.get('documentType') ?? '')
  const isThirdParty = documentType === THIRD_PARTY_CERTIFICATE

  return {
    ownerType: String(formData.get('ownerType') ?? ''),
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
    approvedFor: isThirdParty
      ? formData.getAll('approvedFor').map((value) => String(value))
      : [],
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

  // Approval bodies are a join table, so replace the set rather than diffing it.
  await db.$transaction([
    db.documentApproval.deleteMany({ where: { documentId: id } }),
    db.document.update({
      where: { id },
      data: {
        ...fields,
        approvedFor: { create: approvedFor.map((body) => ({ body })) },
      },
    }),
  ])

  revalidatePath(`/${OWNER_PATH[ownerType]}/${ownerId}`)
  revalidatePath(`/${OWNER_PATH[ownerType]}`)
  return { ok: true }
}

export async function deleteDocument(id: string) {
  const document = await db.document.findUnique({ where: { id } })
  if (!document) return

  await db.document.delete({ where: { id } })

  const ownerType = document.ownerType as OwnerType
  const ownerId =
    document.customerId ?? document.equipmentId ?? document.operatorId

  revalidatePath(`/${OWNER_PATH[ownerType]}/${ownerId}`)
  revalidatePath(`/${OWNER_PATH[ownerType]}`)
}
