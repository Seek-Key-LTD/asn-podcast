import type { Env } from '../context'
import type { Gender } from './types'
import { parseAudioSpeed } from './config'
import { createAudioBlob } from './config'
import { $fetch } from 'ofetch'

/**
 * OmniVoice TTS provider.
 *
 * Calls a self-hosted OmniVoice instance via its Gradio API.
 * The model is a Gradio app, so the interface uses `_design_fn`
 * to submit synthesis parameters and returns a file path to fetch.
 *
 * Voice Cloning mode is supported via TTS_API_ID (reference audio URL).
 */
export async function omnivoiceTTS(text: string, gender: Gender, env: Env): Promise<Blob> {
  const baseURL = env.TTS_API_URL || 'http://localhost:7860'
  const speed = parseAudioSpeed(env.AUDIO_SPEED) ?? 1.0
  const steps = Number(env.TTS_MODEL) || 32
  const cloneAudioUrl = env.TTS_API_ID || null

  const genderParam = gender === '男' ? 'Male / 男' : 'Female / 女'
  const ageParam = 'Young Adult / 青年'
  const pitchParam = gender === '男' ? 'Low Pitch / 低音调' : 'High Pitch / 高音调'
  const accentParam = 'Chinese Accent / 中国口音'
  const endpoint = `${baseURL}/gradio_api/api/_design_fn`

  const payload = {
    data: [
      text,
      'Chinese',
      steps,
      2.0,
      true,
      speed,
      cloneAudioUrl,
      true,
      true,
      genderParam,
      ageParam,
      pitchParam,
      'Auto',
      accentParam,
      'Auto',
    ],
  }

  const result = await $fetch<{ data: [{ path: string }] }>(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 60000,
    body: payload,
  })

  const path = result?.data?.[0]?.path
  if (!path) {
    throw new Error(`OmniVoice TTS failed: ${JSON.stringify(result)}`)
  }

  const audioBuffer = await $fetch<ArrayBuffer>(`${baseURL}/gradio_api/file=${path}`, {
    responseType: 'arrayBuffer',
  })

  return createAudioBlob(audioBuffer)
}
