import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Streams a document's attached file through the server.
 *
 * The Blob store is private (Vercel no longer offers public stores, and a
 * real access check beats an unguessable-URL security model anyway), so the
 * raw Blob URL is useless to a browser on its own — every read has to carry
 * BLOB_READ_WRITE_TOKEN, which only ever lives server-side. This route is
 * the one place that happens: it looks the file up by document id (never by
 * a client-supplied URL, so there's nothing here for a caller to redirect
 * into fetching something outside our own store), fetches it with the
 * token, and streams the bytes back. Access control is the same as every
 * other route in the app — src/middleware.ts's site password.
 *
 * `?download` forces a save-as instead of an inline view — see
 * DocumentsSection.tsx's `fileActionLabel`.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const document = await db.document.findUnique({
    where: { id },
    select: { fileUrl: true, fileName: true, fileType: true },
  })

  if (!document?.fileUrl) {
    return new NextResponse('Not found', { status: 404 })
  }

  const blob = await get(document.fileUrl, { access: 'private' })

  if (!blob || blob.statusCode !== 200) {
    return new NextResponse('Not found', { status: 404 })
  }

  const forceDownload = new URL(request.url).searchParams.has('download')
  // Strip characters that could break or inject into the header — fileName
  // is the original filename as uploaded, so it's user-controlled input.
  const safeFileName = (document.fileName ?? 'document').replace(/["\r\n]/g, '_')

  return new NextResponse(blob.stream, {
    headers: {
      'content-type': document.fileType ?? blob.blob.contentType,
      'content-disposition': `${forceDownload ? 'attachment' : 'inline'}; filename="${safeFileName}"`,
    },
  })
}
