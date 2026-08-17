import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import {
  DOCUMENT_FILE_ALLOWED_TYPES,
  DOCUMENT_FILE_MAX_BYTES,
  OWNER_TYPES,
} from '@/lib/enums'

/**
 * Issues Vercel Blob client tokens for document file uploads.
 *
 * The file itself never passes through this route, or any Next.js server
 * function — the browser uploads directly to Blob storage using the token
 * issued here (see `upload()` in DocumentForm.tsx). That matters on Vercel:
 * Server Actions cap request bodies at 1MB by default, and serverless
 * functions carry their own hard body-size ceiling on top of that regardless
 * of config — well under what a scanned certificate or a phone photo of one
 * produces. Client uploads sidestep both limits entirely.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Not the real access control — src/middleware.ts's site password
        // already stands between this route and the internet, same as every
        // other route in the app. This just rejects a malformed path before
        // a token is issued for it: documents/<OWNER_TYPE>/<ownerId>/<name>.
        const [root, ownerType, ownerId] = pathname.split('/')
        const validOwnerType = OWNER_TYPES.includes(
          ownerType as (typeof OWNER_TYPES)[number],
        )

        if (root !== 'documents' || !validOwnerType || !ownerId) {
          throw new Error('Invalid upload path')
        }

        return {
          allowedContentTypes: [...DOCUMENT_FILE_ALLOWED_TYPES],
          maximumSizeInBytes: DOCUMENT_FILE_MAX_BYTES,
          addRandomSuffix: true,
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 },
    )
  }
}
