export interface Model {
  id: string
  title: string
  description: string
  inputType: 'TEXT' | 'IMAGE'
  inputData: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'BANNED'
  modelUrl?: string
  previewUrl?: string
  createdAt: string
}

export type ImageInputMode = 'URL' | 'UPLOAD'

export interface FormDataState {
  title: string
  description: string
  inputType: 'TEXT' | 'IMAGE'
  inputData: string
  width: string
  height: string
  depth: string
  material: string
  color: string
  style: string
  quality: 'low' | 'medium' | 'high'
  texture: boolean
  imageMode: ImageInputMode
  imageFilename: string
}

export const createInitialFormData = (): FormDataState => ({
  title: '',
  description: '',
  inputType: 'TEXT',
  inputData: '',
  width: '',
  height: '',
  depth: '',
  material: '',
  color: '',
  style: '',
  quality: 'medium',
  texture: false,
  imageMode: 'UPLOAD',
  imageFilename: ''
})
