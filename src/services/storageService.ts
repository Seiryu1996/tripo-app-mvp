import { Storage, UploadOptions } from '@google-cloud/storage'

interface ParsedObjectPath {
  bucket: string
  object: string
}

interface UploadFromSourceParams {
  source: string
  userId: string
  modelId: string
  filename: string
}

const bucketName = process.env.GCS_BUCKET_NAME
const projectId = process.env.GCP_PROJECT_ID
const clientEmail = process.env.GCP_CLIENT_EMAIL
const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n')

let storage: Storage | null = null

function getStorage() {
  if (storage) return storage

  const hasExplicitCredentials = clientEmail && privateKey
  storage = new Storage({
    projectId: projectId || undefined,
    credentials: hasExplicitCredentials
      ? {
          client_email: clientEmail,
          private_key: privateKey,
        }
      : undefined,
  })

  return storage
}

function requireBucket() {
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME is not configured')
  }

  return getStorage().bucket(bucketName)
}

async function saveBufferToBucket(buffer: Buffer, destination: string, contentType?: string) {
  const bucket = requireBucket()
  const file = bucket.file(destination)

  const uploadOptions: UploadOptions = {
    resumable: false,
    metadata: {
      cacheControl: 'private, max-age=0, no-cache',
      contentType,
    },
  }

  await file.save(buffer, uploadOptions)

  return `gs://${bucket.name}/${destination}`
}

function guessExtensionFromContentType(contentType?: string | null) {
  if (!contentType) return ''

  if (contentType.includes('gltf')) return '.gltf'
  if (contentType.includes('glb')) return '.glb'
  if (contentType.includes('zip')) return '.zip'
  if (contentType.includes('fbx')) return '.fbx'
  if (contentType.includes('obj')) return '.obj'
  if (contentType.includes('png')) return '.png'
  if (contentType.includes('jpeg')) return '.jpg'
  if (contentType.includes('jpg')) return '.jpg'
  if (contentType.includes('webp')) return '.webp'
  if (contentType.includes('gif')) return '.gif'
  return ''
}

function guessExtensionFromUrl(url: string) {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname
    const match = pathname.match(/\.(\w+)(?:$|\?)/)
    return match ? `.${match[1]}` : ''
  } catch {
    return ''
  }
}

function buildDestination({ userId, modelId, filename }: UploadFromSourceParams, fallbackExtension = '') {
  const extension = filename.includes('.') ? '' : fallbackExtension
  return `users/${userId}/models/${modelId}/${filename}${extension}`
}

async function uploadBase64DataUri(params: UploadFromSourceParams) {
  const { source } = params
  const match = source.match(/^data:(.*?);base64,(.*)$/)
  if (!match) {
    throw new Error('Invalid data URI format')
  }

  const contentType = match[1]
  const data = match[2]
  const buffer = Buffer.from(data, 'base64')
  const extension = guessExtensionFromContentType(contentType)
  const destination = buildDestination(params, extension)

  return saveBufferToBucket(buffer, destination, contentType)
}

async function uploadFromRemoteUrl(params: UploadFromSourceParams) {
  const { source } = params
  const response = await fetch(source)

  if (!response.ok) {
    throw new Error(`Failed to fetch remote asset: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') || undefined
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const extension = guessExtensionFromContentType(contentType) || guessExtensionFromUrl(source)
  const destination = buildDestination(params, extension)

  return saveBufferToBucket(buffer, destination, contentType)
}

export class StorageService {
  static isConfigured() {
    return Boolean(bucketName)
  }

  static async uploadModelAsset(params: UploadFromSourceParams) {
    if (!this.isConfigured()) {
      throw new Error('Storage is not configured')
    }

    if (params.source.startsWith('data:')) {
      return uploadBase64DataUri(params)
    }

    return uploadFromRemoteUrl(params)
  }

  private static parseResourcePath(resource: string): ParsedObjectPath {
    if (!resource) {
      throw new Error('Resource path is empty')
    }

    // Already gs://bucket/object
    if (resource.startsWith('gs://')) {
      const rest = resource.slice('gs://'.length)
      const [bucket, ...objectParts] = rest.split('/')
      if (!bucket || objectParts.length === 0) {
        throw new Error('Invalid gs:// resource path')
      }
      return { bucket, object: objectParts.join('/') }
    }

    try {
      const url = new URL(resource)

      // https://storage.googleapis.com/bucket/object
      if (url.hostname === 'storage.googleapis.com') {
        const [_, bucket, ...objectParts] = url.pathname.split('/')
        if (!bucket || objectParts.length === 0) {
          throw new Error('Invalid storage URL: missing bucket name')
        }
        return { bucket, object: objectParts.join('/') }
      }

      // https://bucket.storage.googleapis.com/object
      if (url.hostname.endsWith('.storage.googleapis.com')) {
        const bucket = url.hostname.replace('.storage.googleapis.com', '')
        const object = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
        if (!bucket || !object) {
          throw new Error('Invalid Google Cloud Storage URL')
        }
        return { bucket, object }
      }

      throw new Error('Unsupported storage URL format')
    } catch (error) {
      console.error('[Storage] Failed to parse resource path:', resource, error)
      throw new Error('Invalid storage resource path')
    }
  }

  static async download(resource: string) {
    if (!this.isConfigured()) {
      throw new Error('Storage is not configured')
    }

    const { bucket, object } = this.parseResourcePath(resource)
    const file = getStorage().bucket(bucket).file(object)
    const [metadata] = await file.getMetadata()
    const [buffer] = await file.download()

    const size = typeof metadata.size === 'number'
      ? metadata.size
      : metadata.size
        ? Number(metadata.size)
        : undefined

    return {
      buffer,
      contentType: metadata.contentType || 'application/octet-stream',
      contentLength: size ?? buffer.length,
      updated: metadata.updated,
      objectPath: object,
    }
  }
}
