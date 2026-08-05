/**
 * Toast system — global singleton pattern
 * Can be called from anywhere (including outside React)
 */

import { useState, useEffect } from 'react'

type ToastVariant = 'default' | 'destructive' | 'success' | 'warning' | 'info'

interface ToastData {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
}

type Listener = (toasts: ToastData[]) => void

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 6000

let memoryState: ToastData[] = []
const listeners: Listener[] = []

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

function dispatch() {
  listeners.forEach((l) => l([...memoryState]))
}

function addToast(t: Omit<ToastData, 'id'>) {
  const id = genId()
  memoryState = [{ ...t, id }, ...memoryState].slice(0, TOAST_LIMIT)
  dispatch()

  setTimeout(() => {
    memoryState = memoryState.filter((item) => item.id !== id)
    dispatch()
  }, TOAST_REMOVE_DELAY)

  return id
}

function dismissToast(id: string) {
  memoryState = memoryState.filter((t) => t.id !== id)
  dispatch()
}

export function toast(props: Omit<ToastData, 'id'>) {
  return addToast(props)
}

toast.success = (title: string, description?: string) =>
  addToast({ title, description, variant: 'success' })

toast.error = (title: string, description?: string) =>
  addToast({ title, description, variant: 'destructive' })

toast.warning = (title: string, description?: string) =>
  addToast({ title, description, variant: 'warning' })

toast.info = (title: string, description?: string) =>
  addToast({ title, description, variant: 'info' })

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>(memoryState)

  useEffect(() => {
    listeners.push(setToasts)
    return () => {
      const idx = listeners.indexOf(setToasts)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return { toasts, toast, dismissToast }
}

export type { ToastData, ToastVariant }
