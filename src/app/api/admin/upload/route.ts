import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getFirebaseAdminStorageBucket } from '@/lib/server/firebase-admin'
import { writeAuditLog } from '@/lib/server/audit-log'
import { HttpError, jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function POST(request: Request) {
  try {
    const admin = await requireAdminPermission(['entities.write', 'media.write'])
    const formData = await request.formData()
    const files = Array.from(formData.values()).filter(
      (value): value is File => value instanceof File && value.size > 0,
    )

    if (files.length === 0) {
      throw new HttpError('No files were uploaded.', 400)
    }

    if (files.length > 10) {
      throw new HttpError('Upload supports at most 10 files at a time.', 400)
    }

    const maxFileSize = readMaxFileSizeBytes()
    const bucket = getFirebaseAdminStorageBucket()
    const uploadedFiles = []

    for (const file of files) {
      if (file.size > maxFileSize) {
        throw new HttpError(file.name + ' is too large.', 413)
      }

      const token = randomUUID()
      const safeName = sanitizeFileName(file.name)
      const storagePath = 'admin-uploads/' + randomUUID() + '/' + safeName
      const storageFile = bucket.file(storagePath)
      const bytes = Buffer.from(await file.arrayBuffer())

      await storageFile.save(bytes, {
        contentType: file.type || 'application/octet-stream',
        metadata: {
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      })

      uploadedFiles.push({
        name: file.name,
        mimetype: file.type,
        size: file.size,
        url:
          'https://firebasestorage.googleapis.com/v0/b/' +
          bucket.name +
          '/o/' +
          encodeURIComponent(storagePath) +
          '?alt=media&token=' +
          token,
      })
    }
    await writeAuditLog({
      action: 'media.upload',
      actor: admin,
      metadata: {
        files: uploadedFiles.map(file => ({
          mimetype: file.mimetype,
          name: file.name,
          size: file.size,
        })),
        filesCount: uploadedFiles.length,
      },
      resourceType: 'media',
    })

    return NextResponse.json({
      status: true,
      message: 'Files are uploaded.',
      data: uploadedFiles,
    })
  } catch (error) {
    return jsonError(error)
  }
}

function readMaxFileSizeBytes() {
  const rawValue = Number.parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB ?? '10', 10)
  const megabytes = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 10
  return megabytes * 1024 * 1024
}

function sanitizeFileName(name: string) {
  const safe = name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)

  return safe.length > 0 ? safe : 'file'
}
