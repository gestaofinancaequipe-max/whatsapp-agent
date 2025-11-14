import axios from 'axios'

const DEFAULT_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0'

function getAccessToken(token?: string) {
  const resolved = token || process.env.WHATSAPP_TOKEN
  if (!resolved) {
    throw new Error('WHATSAPP_TOKEN não está configurado')
  }
  return resolved
}

/**
 * Busca a URL pública temporária de um media (imagem/áudio) via Graph API.
 */
export async function getMediaUrl(
  mediaId: string,
  token?: string,
  apiVersion: string = DEFAULT_API_VERSION
): Promise<string> {
  const accessToken = getAccessToken(token)
  const mediaUrl = `https://graph.facebook.com/${apiVersion}/${mediaId}`

  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `Failed to fetch media url (${response.status}): ${body || 'unknown error'}`
    )
  }

  const data = await response.json()
  if (!data.url) {
    throw new Error('Media response did not include url field')
  }

  return data.url as string
}

/**
 * Baixa o conteúdo binário de um media a partir da URL temporária.
 */
export async function downloadMedia(
  mediaUrl: string,
  token?: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const accessToken = getAccessToken(token)

  const response = await axios.get(mediaUrl, {
    responseType: 'arraybuffer',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const buffer = Buffer.from(response.data)
  const mimeType = response.headers['content-type'] || 'application/octet-stream'

  return { buffer, mimeType }
}

/**
 * Helper completo: busca a URL e baixa o media.
 */
export async function fetchMediaBinary(
  mediaId: string,
  token?: string,
  apiVersion: string = DEFAULT_API_VERSION
): Promise<{ buffer: Buffer; mimeType: string; url: string }> {
  const url = await getMediaUrl(mediaId, token, apiVersion)
  const { buffer, mimeType } = await downloadMedia(url, token)
  return { buffer, mimeType, url }
}

