import { readFile, stat } from "node:fs/promises"
import type { ReadImageOutput } from "../rpc"

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
}

const MAX_BYTES = 5 * 1024 * 1024

export async function readImage(path: string): Promise<ReadImageOutput> {
  try {
    const extension = path.split(".").pop()?.toLowerCase() ?? ""
    const type = TYPES[extension]
    if (!type) return { error: "Unsupported image type. Use png, jpg, webp or gif." }

    const info = await stat(path)
    if (!info.isFile()) return { error: "Not a file." }
    if (info.size > MAX_BYTES) return { error: "Image is larger than 5 MB." }

    const bytes = await readFile(path)
    return { dataUrl: `data:${type};base64,${bytes.toString("base64")}` }
  } catch {
    return { error: "Could not read the image." }
  }
}
