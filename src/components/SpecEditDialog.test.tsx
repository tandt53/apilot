/**
 * SpecEditDialog Tests
 * Tests for spec editing modal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SpecEditDialog from './SpecEditDialog'
import type { Spec } from '@/types/database'

describe('SpecEditDialog', () => {
  const mockSpec: Spec = {
    id: 1,
    name: 'Test API',
    version: '1.0.0',
    description: 'Test API description',
    baseUrl: 'https://api.example.com',
    rawSpec: '{}',
    format: 'openapi',
    versionGroup: 'test-uuid',
    isLatest: true,
    originalName: 'Test API',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockOnSave = vi.fn()
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render dialog when open is true', () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByText('Edit Spec')).toBeInTheDocument()
    })

    it('should not render dialog when open is false', () => {
      render(
        <SpecEditDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      expect(screen.queryByText('Edit Spec')).not.toBeInTheDocument()
    })

    it('should populate form fields with spec data', () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const nameInput = screen.getByPlaceholderText('My API') as HTMLInputElement
      const versionInput = screen.getByPlaceholderText('1.0.0') as HTMLInputElement
      const descriptionInput = screen.getByPlaceholderText('Optional description of your API') as HTMLTextAreaElement
      const baseUrlInput = screen.getByPlaceholderText('https://api.example.com') as HTMLInputElement

      expect(nameInput.value).toBe('Test API')
      expect(versionInput.value).toBe('1.0.0')
      expect(descriptionInput.value).toBe('Test API description')
      expect(baseUrlInput.value).toBe('https://api.example.com')
    })

    it('should show required field indicators', () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const requiredMarkers = screen.getAllByText('*')
      expect(requiredMarkers.length).toBeGreaterThanOrEqual(2) // Name and Version
    })
  })

  describe('Validation', () => {
    it('should show error when name is empty', async () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const nameInput = screen.getByPlaceholderText('My API')
      const saveButton = screen.getByText('Save Changes')

      fireEvent.change(nameInput, { target: { value: '' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument()
      })

      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('should show error when version is empty', async () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const versionInput = screen.getByPlaceholderText('1.0.0')
      const saveButton = screen.getByText('Save Changes')

      fireEvent.change(versionInput, { target: { value: '' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Version is required')).toBeInTheDocument()
      })

      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('should show error for invalid semantic version', async () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const versionInput = screen.getByPlaceholderText('1.0.0')
      const saveButton = screen.getByText('Save Changes')

      fireEvent.change(versionInput, { target: { value: 'invalid' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Version must be in semantic format (e.g., 1.0.0)')).toBeInTheDocument()
      })

      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('should accept valid semantic versions', async () => {
      const validVersions = ['1.0.0', '2.3.4', '10.20.30', '1.0.0-beta', '1.0.0-alpha.1']

      for (const version of validVersions) {
        vi.clearAllMocks()

        const { unmount } = render(
          <SpecEditDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            spec={mockSpec}
            onSave={mockOnSave}
          />
        )

        const versionInput = screen.getByPlaceholderText('1.0.0')
        const saveButton = screen.getByText('Save Changes')

        fireEvent.change(versionInput, { target: { value: version } })
        fireEvent.click(saveButton)

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled()
        })

        unmount()
      }
    })

    it('should show error for invalid base URL', async () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const baseUrlInput = screen.getByPlaceholderText('https://api.example.com')
      const saveButton = screen.getByText('Save Changes')

      fireEvent.change(baseUrlInput, { target: { value: 'not-a-url' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Base URL must be a valid URL (e.g., https://api.example.com)')).toBeInTheDocument()
      })

      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('should allow empty base URL (optional field)', async () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const baseUrlInput = screen.getByPlaceholderText('https://api.example.com')
      const saveButton = screen.getByText('Save Changes')

      fireEvent.change(baseUrlInput, { target: { value: '' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled()
      })
    })
  })

  describe('Form Submission', () => {
    it('should call onSave with trimmed values', async () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const nameInput = screen.getByPlaceholderText('My API')
      const saveButton = screen.getByText('Save Changes')

      fireEvent.change(nameInput, { target: { value: '  Trimmed Name  ' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          name: 'Trimmed Name',
          version: '1.0.0',
          description: 'Test API description',
          baseUrl: 'https://api.example.com',
        })
      })
    })

    it('should handle empty description', async () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const descriptionInput = screen.getByPlaceholderText('Optional description of your API')
      const saveButton = screen.getByText('Save Changes')

      fireEvent.change(descriptionInput, { target: { value: '' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          name: 'Test API',
          version: '1.0.0',
          description: undefined,
          baseUrl: 'https://api.example.com',
        })
      })
    })

    it('should show saving state during submission', async () => {
      const slowOnSave = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={slowOnSave}
        />
      )

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument()
      })
    })

    it('should show success message after save', async () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Saved successfully!')).toBeInTheDocument()
      })
    })

    it.skip('should close dialog after successful save', async () => {
      vi.useFakeTimers()

      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled()
      })

      // Fast-forward 500ms (success message delay) and resolve pending promises
      await vi.advanceTimersByTimeAsync(500)

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)

      vi.useRealTimers()
    })

    it.skip('should show error message on save failure', async () => {
      const failingOnSave = vi.fn().mockRejectedValue(new Error('Save failed'))

      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={failingOnSave}
        />
      )

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(
        () => {
          expect(screen.getByText(/Save failed: Save failed/)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })
  })

  describe('User Interactions', () => {
    it('should close dialog when Cancel is clicked', () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })

    it('should close dialog when X button is clicked', () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const closeButton = screen.getByLabelText('Close')
      fireEvent.click(closeButton)

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })

    it.skip('should handle keyboard shortcut (Cmd/Ctrl + Enter)', async () => {
      render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      // Get the dialog content (where onKeyDown is attached)
      const dialogContent = screen.getByRole('dialog')

      // Simulate Cmd+Enter on the dialog
      fireEvent.keyDown(dialogContent, { key: 'Enter', metaKey: true })

      await waitFor(
        () => {
          expect(mockOnSave).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )
    })
  })

  describe('Form Reset', () => {
    it('should reset form when dialog is reopened', async () => {
      const { rerender } = render(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const nameInput = screen.getByPlaceholderText('My API') as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'Modified Name' } })
      expect(nameInput.value).toBe('Modified Name')

      // Close dialog
      rerender(
        <SpecEditDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      // Reopen dialog
      rerender(
        <SpecEditDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          spec={mockSpec}
          onSave={mockOnSave}
        />
      )

      const resetNameInput = screen.getByPlaceholderText('My API') as HTMLInputElement
      expect(resetNameInput.value).toBe('Test API') // Reset to original
    })
  })
})
