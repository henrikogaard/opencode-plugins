import { createEffect, onCleanup } from "solid-js"
import type { SetupContext } from "@opencode/plugin/gui"
import { Workbench, type ReadImageOutput } from "../rpc"
import { bayer, clamp, field, glyph, type AmbientMode } from "../shared/ambient"
import type { definition } from "./definition"

const FRAME_MS = 1_000 / 30

/**
 * A slow animated layer behind the app: ordered dithering, coarse pixels, an
 * ASCII field, or a drifting image. Rendered on a canvas fixed behind `#root`,
 * with the base surface made translucent while a mode is active.
 */
export function installAmbient(ctx: SetupContext<typeof definition>): void {
  const prefs = ctx.stores.prefs
  const canvas = document.createElement("canvas")
  canvas.id = "workbench-ambient"

  const context = canvas.getContext("2d")
  const offscreen = document.createElement("canvas")

  let image: HTMLImageElement | undefined
  let imageKey = ""
  let frame = 0
  let last = 0
  let stopped = true

  const reduced = () =>
    document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const ink = () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--v2-text-text-base").trim()
    return value || (ctx.appearance.mode() === "dark" ? "#e8e3dc" : "#1c1b19")
  }

  const resize = () => {
    canvas.width = Math.max(1, window.innerWidth)
    canvas.height = Math.max(1, window.innerHeight)
  }

  const drawImage = (time: number) => {
    if (!context || !image) return

    const width = canvas.width
    const height = canvas.height
    const scale = Math.max(width / image.width, height / image.height) * 1.15
    const driftX = Math.sin(time * 0.05) * width * 0.02
    const driftY = Math.cos(time * 0.04) * height * 0.02

    offscreen.width = Math.max(1, Math.floor(width / 4))
    offscreen.height = Math.max(1, Math.floor(height / 4))

    const small = offscreen.getContext("2d")
    if (!small) return

    small.clearRect(0, 0, offscreen.width, offscreen.height)
    small.drawImage(
      image,
      (offscreen.width - image.width * (scale / 4)) / 2 + driftX / 4,
      (offscreen.height - image.height * (scale / 4)) / 2 + driftY / 4,
      image.width * (scale / 4),
      image.height * (scale / 4),
    )

    context.clearRect(0, 0, width, height)
    context.imageSmoothingEnabled = false
    context.drawImage(offscreen, 0, 0, width, height)
  }

  const drawField = (time: number, mode: AmbientMode) => {
    if (!context) return

    const width = canvas.width
    const height = canvas.height
    const color = ink()

    context.clearRect(0, 0, width, height)
    context.fillStyle = color

    if (mode === "dither") {
      const cell = 3
      for (let y = 0; y < height; y += cell) {
        for (let x = 0; x < width; x += cell) {
          if (field(x / 48, y / 48, time) > bayer(x / cell, y / cell)) context.fillRect(x, y, cell, cell)
        }
      }
      return
    }

    if (mode === "pixel") {
      const cell = 6
      for (let y = 0; y < height; y += cell) {
        for (let x = 0; x < width; x += cell) {
          context.globalAlpha = 0.08 + field(x / 96, y / 96, time) * 0.5
          context.fillRect(x, y, cell, cell)
        }
      }
      context.globalAlpha = 1
      return
    }

    context.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace"
    const cellWidth = 10
    const cellHeight = 16

    for (let y = 0; y < height; y += cellHeight) {
      for (let x = 0; x < width; x += cellWidth) {
        const value = field(x / 160, y / 160, time * 0.5)
        const character = glyph(value)
        if (character !== " ") context.fillText(character, x, y + cellHeight * 0.8)
      }
    }
  }

  const render = (mode: AmbientMode) => {
    const speed = clamp(prefs.value.ambientSpeed, 1, 10) / 3
    const step = (time: number) => {
      if (stopped) return
      frame = requestAnimationFrame(step)

      if (document.hidden || time - last < FRAME_MS) return
      last = time

      const seconds = (time / 1_000) * speed
      if (mode === "image") drawImage(seconds)
      else drawField(seconds, mode)
    }

    last = 0
    stopped = false
    frame = requestAnimationFrame(step)

    if (reduced()) {
      stopped = true
      cancelAnimationFrame(frame)
      if (mode === "image") drawImage(0)
      else drawField(0, mode)
    }
  }

  const stop = () => {
    stopped = true
    cancelAnimationFrame(frame)
  }

  const onResize = () => {
    resize()
    if (!stopped && context) {
      const mode = prefs.value.ambient
      if (mode === "image") drawImage(0)
      else if (mode !== "off") drawField(0, mode)
    }
  }

  createEffect(() => {
    const mode = prefs.value.ambient

    if (mode === "off") {
      stop()
      canvas.remove()
      delete document.documentElement.dataset.workbenchAmbient
      return
    }

    document.documentElement.dataset.workbenchAmbient = "on"
    canvas.style.opacity = String(clamp(prefs.value.ambientIntensity, 0, 100) / 100)
    if (!canvas.isConnected) {
      resize()
      document.body.append(canvas)
    }
    render(mode)
  })

  createEffect(() => {
    const path = prefs.value.ambientImage.trim()
    if (prefs.value.ambient !== "image" || !path || path === imageKey) return

    const options = ctx.sessions.current()
      ? { location: { directory: ctx.sessions.current()!.directory } }
      : undefined

    void ctx.client
      .rpc(Workbench)
      .readImage({ path }, options)
      .then((result) => {
        const output = result as ReadImageOutput
        if (!output.dataUrl) {
          ctx.toast.show({ title: ctx.t("ambient.image.error"), description: output.error })
          return
        }

        imageKey = path
        const next = new Image()
        next.onload = () => {
          image = next
        }
        next.src = output.dataUrl
      })
      .catch(() => ctx.toast.show({ title: ctx.t("ambient.image.error") }))
  })

  const onHidden = () => {
    if (document.hidden) stop()
    else if (prefs.value.ambient !== "off" && !reduced()) render(prefs.value.ambient)
  }

  window.addEventListener("resize", onResize)
  document.addEventListener("visibilitychange", onHidden)

  onCleanup(() => {
    stop()
    canvas.remove()
    window.removeEventListener("resize", onResize)
    document.removeEventListener("visibilitychange", onHidden)
    delete document.documentElement.dataset.workbenchAmbient
  })
}
