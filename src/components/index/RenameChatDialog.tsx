import { useEffect, useState } from 'react'
import type Chat from '@/interfaces/Chat'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface RenameChatDialogProps {
  chat: Chat | null
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => Promise<void>
}

export default function RenameChatDialog({ chat, onOpenChange, onSubmit }: RenameChatDialogProps) {
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (chat) {
      setName(chat.name)
      setIsSubmitting(false)
    }
  }, [chat])

  return (
    <Dialog open={Boolean(chat)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setIsSubmitting(true)
            void onSubmit(name).finally(() => setIsSubmitting(false))
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription>Choose a new name for this chat.</DialogDescription>
          </DialogHeader>
          <Input
            className="my-4"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
