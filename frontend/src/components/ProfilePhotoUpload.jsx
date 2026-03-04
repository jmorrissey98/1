import { useState, useRef } from 'react';
import { Camera, Loader2, X, User } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

/**
 * ProfilePhotoUpload - Reusable component for uploading profile photos
 * 
 * Props:
 * - currentPhoto: string | null - Current photo URL or base64
 * - name: string - Name for displaying initials if no photo
 * - onPhotoChange: (photoData: string) => Promise<void> - Callback when photo is uploaded
 * - size: 'sm' | 'md' | 'lg' - Size variant (default: 'md')
 * - editable: boolean - Whether upload is allowed (default: true)
 */
export default function ProfilePhotoUpload({ 
  currentPhoto, 
  name = '', 
  onPhotoChange, 
  size = 'md',
  editable = true 
}) {
  const [uploading, setUploading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const fileInputRef = useRef(null);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const initialSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  const displayPhoto = previewPhoto || currentPhoto;
  const initial = name?.charAt(0)?.toUpperCase() || '?';

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result;
        
        // Show preview immediately
        setPreviewPhoto(base64);

        // Call the upload callback
        if (onPhotoChange) {
          try {
            await onPhotoChange(base64);
            toast.success('Photo updated');
          } catch (err) {
            console.error('Failed to update photo:', err);
            toast.error('Failed to update photo');
            setPreviewPhoto(null); // Revert preview on error
          }
        }
        
        setUploading(false);
      };

      reader.onerror = () => {
        toast.error('Failed to read image file');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error processing image:', err);
      toast.error('Failed to process image');
      setUploading(false);
    }

    // Clear input for re-selection
    e.target.value = '';
  };

  const handleRemovePhoto = async () => {
    if (!onPhotoChange) return;
    
    setUploading(true);
    try {
      await onPhotoChange('');
      setPreviewPhoto(null);
      toast.success('Photo removed');
    } catch (err) {
      toast.error('Failed to remove photo');
    }
    setUploading(false);
  };

  return (
    <div className="relative inline-block group">
      {/* Photo/Initial Circle */}
      <div 
        className={`${sizeClasses[size]} rounded-full bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 relative`}
      >
        {displayPhoto ? (
          <img 
            src={displayPhoto} 
            alt={name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={`${initialSizes[size]} font-medium text-slate-500`}>
            {initial}
          </span>
        )}

        {/* Loading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          </div>
        )}
      </div>

      {/* Edit overlay - only show if editable */}
      {editable && !uploading && (
        <div 
          className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className={`${iconSizes[size]} text-white opacity-0 group-hover:opacity-100 transition-opacity`} />
        </div>
      )}

      {/* Remove button - show if has photo and editable */}
      {editable && displayPhoto && !uploading && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemovePhoto();
          }}
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove photo"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="photo-upload-input"
      />
    </div>
  );
}
