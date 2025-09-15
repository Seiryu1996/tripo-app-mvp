'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader, OrbitControls } from 'three-stdlib'

interface ModelViewerProps {
  modelUrl?: string
  className?: string
}

export default function ModelViewer({ modelUrl, className = '' }: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const animationFrameRef = useRef<number>()
  const modelGroupRef = useRef<THREE.Group | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!mountRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f0f0)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.set(0, 0, 2)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer
    mountRef.current.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    scene.add(ambientLight)

    const cameraLight = new THREE.DirectionalLight(0xffffff, 0.6)
    cameraLight.position.set(0, 0, 1)
    camera.add(cameraLight)
    scene.add(camera)

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3)
    backLight.position.set(-10, -10, -5)
    scene.add(backLight)

    const sideLight1 = new THREE.DirectionalLight(0xffffff, 0.2)
    sideLight1.position.set(10, 0, 0)
    scene.add(sideLight1)

    const sideLight2 = new THREE.DirectionalLight(0xffffff, 0.2)
    sideLight2.position.set(-10, 0, 0)
    scene.add(sideLight2)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.screenSpacePanning = false
    controls.minDistance = 0.5
    controls.maxDistance = 10
    controls.maxPolarAngle = Math.PI
    controlsRef.current = controls

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate)
      
      if (controlsRef.current) {
        controlsRef.current.update()
      }
      
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return
      
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
    }
    
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      
      if (controlsRef.current) {
        controlsRef.current.dispose()
      }
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    if (!modelUrl || !sceneRef.current) return

    setIsLoading(true)
    setLoadError(null)

    if (modelGroupRef.current) {
      sceneRef.current.remove(modelGroupRef.current)
      modelGroupRef.current = null
    }

    if (!modelUrl.startsWith('http://') && !modelUrl.startsWith('https://')) {
      setLoadError('無効なモデルURLです')
      setIsLoading(false)
      return
    }
    
    const loader = new GLTFLoader()
    
    if (!modelUrl.includes('tripo-data')) {
      setLoadError('Tripoモデルのみ表示可能です')
      setIsLoading(false)
      return
    }
    
    const proxyUrl = `/api/proxy/model?url=${encodeURIComponent(modelUrl)}`
    
    loader.load(
      proxyUrl,
      (gltf) => {
        const modelGroup = new THREE.Group()
        modelGroup.add(gltf.scene)
        
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const size = box.getSize(new THREE.Vector3())
        const maxSize = Math.max(size.x, size.y, size.z)
        
        const scale = maxSize > 0 ? 2 / maxSize : 1
        
        gltf.scene.scale.multiplyScalar(scale)
        
        const center = box.getCenter(new THREE.Vector3())
        gltf.scene.position.sub(center.multiplyScalar(scale))
        
        sceneRef.current!.add(modelGroup)
        modelGroupRef.current = modelGroup
        
        setIsLoading(false)
      },
      undefined,
      (error) => {
        let errorMessage = '3Dモデルの読み込みに失敗しました'
        if (error.message) {
          if (error.message.includes('CORS')) {
            errorMessage = 'CORS エラー: モデルファイルにアクセスできません'
          } else if (error.message.includes('404')) {
            errorMessage = 'モデルファイルが見つかりません'
          } else if (error.message.includes('network')) {
            errorMessage = 'ネットワークエラーが発生しました'
          } else {
            errorMessage = `読み込みエラー: ${error.message}`
          }
        }
        
        setLoadError(errorMessage)
        setIsLoading(false)
      }
    )
    
  }, [modelUrl])

  return (
    <div 
      ref={mountRef} 
      className={`w-full h-64 border border-gray-300 rounded-lg overflow-hidden relative ${className}`}
      style={{ minHeight: '256px' }}
    >
      {!modelUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
          3Dモデルプレビュー
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
            <span>3Dモデルを読み込み中...</span>
          </div>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-600 text-sm p-4">
          {loadError}
        </div>
      )}
    </div>
  )
}
