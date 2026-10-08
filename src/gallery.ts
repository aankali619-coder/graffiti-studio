import { supabase, supabaseConfigured } from './lib/supabase'
import type { Editor } from './editor/Editor'

export interface Artwork {
  id: string
  title: string
  artist: string
  image_path: string
  width: number | null
  height: number | null
  created_at: string
}

export function artworkUrl(path: string): string {
  return supabase!.storage.from('artwork').getPublicUrl(path).data.publicUrl
}

/** Renders the current canvas and uploads it to the public gallery. */
export async function publishArtwork(ed: Editor, title: string, artist: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured')
  const canvas = ed.composite()
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render PNG'))), 'image/png'),
  )
  const path = `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
  const { error: uploadError } = await supabase.storage
    .from('artwork')
    .upload(path, blob, { contentType: 'image/png', upsert: false })
  if (uploadError) throw uploadError

  const { error } = await supabase.from('artworks').insert({
    title: title.trim() || 'Untitled',
    artist: artist.trim() || 'Anonymous',
    image_path: path,
    width: ed.width,
    height: ed.height,
  })
  if (error) throw error
}

export async function fetchArtworks(limit = 30): Promise<Artwork[]> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase
    .from('artworks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Artwork[]
}
