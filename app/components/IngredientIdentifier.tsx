'use client'

import { useState, useRef } from 'react'
import axios from 'axios'

const MAX_IMAGE_SIZE = 800; // Maximum width or height in pixels

function resizeImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_IMAGE_SIZE) {
            height *= MAX_IMAGE_SIZE / width;
            width = MAX_IMAGE_SIZE;
          }
        } else {
          if (height > MAX_IMAGE_SIZE) {
            width *= MAX_IMAGE_SIZE / height;
            height = MAX_IMAGE_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: file.type }));
          } else {
            resolve(file); // If blob is null, return the original file
          }
        }, file.type);
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const processText = (text: string) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
    .replace(/\n/g, '<br>'); // Line breaks
}


export default function IngredientIdentifier() {
  const [file, setFile] = useState<File | null>(null)
  const [ingredients, setIngredients] = useState<string>('')
  const [analysis, setAnalysis] = useState<string>('')
  const [foundUnhealthy, setFoundUnhealthy] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      console.log('Original file size:', selectedFile.size);
      try {
        const resizedFile = await resizeImage(selectedFile);
        console.log('Resized file size:', resizedFile.size);
        setFile(resizedFile);
      } catch (error) {
        console.error('Error resizing file:', error);
        setFile(selectedFile); // Use original file if resizing fails
      }
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError(null)
    const formData = new FormData()
    formData.append('image', file)

    try {
      console.time('API Request');
      console.log('Sending request to API...');
      const response = await axios.post('/api/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      console.timeEnd('API Request');
      console.log('Received response from API');
      setIngredients(response.data.ingredients)
      setAnalysis(response.data.analysis)
      setFoundUnhealthy(response.data.foundUnhealthy)
    } catch (error) {
      console.error('Error analyzing image:', error)
      if (axios.isAxiosError(error) && error.response) {
        setError(JSON.stringify(error.response.data, null, 2))
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex flex-col items-center justify-center w-full">
          <input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*"
          />
          <button
            type="button"
            onClick={handleUploadClick}
            className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Upload Image
          </button>
          {file && (
            <p className="text-sm text-gray-500 mb-4">Selected file: {file.name}</p>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            disabled={!file || loading}
          >
            {loading ? 'Analyzing...' : 'Analyze Ingredients'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="mb-8 text-center">
          <p className="text-lg">Analyzing image... This may take a moment.</p>
          <div className="mt-2 w-8 h-8 border-t-2 border-b-2 border-gray-900 rounded-full animate-spin mx-auto"></div>
        </div>
      )}

      {error && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Error:</h2>
          <pre className="bg-red-100 p-4 rounded overflow-auto max-h-96">
            {error}
          </pre>
        </div>
      )}

      {ingredients && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Ingredients:</h2>
          <p className="text-gray-700">{ingredients}</p>
        </div>
      )}

      {foundUnhealthy.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Unhealthy Ingredients Found (Predefined List):</h2>
          <ul className="list-disc list-inside text-red-600">
            {foundUnhealthy.map((ingredient, index) => (
              <li key={index}>{ingredient}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis && (
        <div>
          <h2 className="text-2xl font-semibold mb-2">Analysis:</h2>
          <div className="bg-gray-100 p-4 rounded" dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br>') }} />
        </div>
      )}
    </div>
  )
}

