import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Check } from 'lucide-react';
import { compressDataUrl, uploadImage, fileToDataUrl } from '../lib/image-upload';

const OPENER_MAXDIM = 2400; // sharper than inline images (1800) for a full-bleed A4 page

interface Props {
  images: { id: string; url: string }[];
  value: string | undefined; // explicit opener URL; undefined = auto (first image)
  onChange: (url: string | undefined) => void;
}

export function OpenerImagePicker({ images, value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const effective = value === 'none' ? undefined : (value ?? images[0]?.url);
  const isUploaded = value !== undefined && value !== 'none' && !images.some((i) => i.url === value);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const blob = await compressDataUrl(await fileToDataUrl(file), OPENER_MAXDIM);
      const url = await uploadImage(blob);
      onChange(url);
    } catch (err) {
      alert('Грешка при качване на корицата: ' + String(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="w-full max-h-28 aspect-[210/297] mx-auto rounded-md overflow-hidden bg-gray-100 mb-2 flex items-center justify-center">
        {effective ? (
          <img src={effective} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImagePlus className="w-5 h-5 text-gray-300" />
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <button
          onClick={() => onChange(undefined)}
          className={`px-2 py-1 text-[10px] rounded border transition-colors ${value === undefined ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          title="Автоматично — първата снимка в статията става корица (и се маха от текста)"
        >
          Авто
        </button>
        <button
          onClick={() => onChange('none')}
          className={`px-2 py-1 text-[10px] rounded border transition-colors ${value === 'none' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          title="Без снимка на корицата — всички снимки остават в текста"
        >
          Без снимка
        </button>
        {images.map((img, i) => (
          <button
            key={img.id}
            onClick={() => onChange(img.url)}
            className={`relative w-10 h-10 rounded overflow-hidden border-2 transition-colors ${value === img.url ? 'border-gray-900' : 'border-transparent hover:border-gray-300'}`}
            title={`Снимка ${i + 1}`}
          >
            <img src={img.url} alt="" className="w-full h-full object-cover" />
            {value === img.url && (
              <span className="absolute inset-0 bg-gray-900/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </span>
            )}
          </button>
        ))}
        {isUploaded && (
          <div className="relative w-10 h-10 rounded overflow-hidden border-2 border-gray-900" title="Качена корица">
            <img src={value} alt="" className="w-full h-full object-cover" />
            <span className="absolute inset-0 bg-gray-900/20 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </span>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] text-gray-600 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
        {uploading ? 'Качвам…' : 'Качи нова'}
      </button>
    </div>
  );
}
