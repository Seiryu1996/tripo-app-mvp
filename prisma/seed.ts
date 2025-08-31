import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // 既存のデータをクリア
  await prisma.model.deleteMany()
  await prisma.user.deleteMany()

  console.log('🗑️  Cleared existing data')

  // 管理者アカウントの作成
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@tripo.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 12)

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      name: '管理者',
      password: hashedAdminPassword,
      role: 'ADMIN',
    },
  })

  console.log('👤 Created admin user:', { email: adminUser.email, name: adminUser.name })

  // テストユーザーの作成
  const testUsers = [
    {
      email: 'user1@tripo.com',
      name: '田中太郎',
      password: 'user123',
      role: 'USER' as const,
    },
    {
      email: 'user2@tripo.com',
      name: '佐藤花子',
      password: 'user123',
      role: 'USER' as const,
    },
    {
      email: 'user3@tripo.com',
      name: '鈴木次郎',
      password: 'user123',
      role: 'USER' as const,
    },
  ]

  const createdUsers = []
  for (const userData of testUsers) {
    const hashedPassword = await bcrypt.hash(userData.password, 12)
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        password: hashedPassword,
        role: userData.role,
      },
    })
    createdUsers.push(user)
    console.log('👤 Created test user:', { email: user.email, name: user.name })
  }

  // サンプル3Dモデルデータの作成
  const sampleModels = [
    {
      title: '青いスポーツカー',
      description: 'リアルなディテールの青いスポーツカーモデル',
      inputType: 'TEXT' as const,
      inputData: 'blue sports car, realistic details, glossy finish',
      status: 'COMPLETED' as const,
      modelUrl: 'https://example.com/models/blue_car.glb',
      previewUrl: 'https://example.com/previews/blue_car.jpg',
    },
    {
      title: '木製の椅子',
      description: 'シンプルなデザインの木製椅子',
      inputType: 'TEXT' as const,
      inputData: 'wooden chair, simple design, brown wood texture',
      status: 'COMPLETED' as const,
      modelUrl: 'https://example.com/models/wooden_chair.glb',
      previewUrl: 'https://example.com/previews/wooden_chair.jpg',
    },
    {
      title: '赤いリンゴ',
      description: '新鮮な赤いリンゴのモデル',
      inputType: 'TEXT' as const,
      inputData: 'fresh red apple, realistic texture, natural lighting',
      status: 'PENDING' as const,
    },
    {
      title: 'モダンな建物',
      description: '現代的なオフィスビル',
      inputType: 'IMAGE' as const,
      inputData: 'https://example.com/input/modern_building.jpg',
      status: 'PROCESSING' as const,
      tripoTaskId: 'task_123456',
    },
    {
      title: 'エラーサンプル',
      description: '処理に失敗したモデルの例',
      inputType: 'TEXT' as const,
      inputData: 'invalid prompt that causes error',
      status: 'FAILED' as const,
    },
  ]

  // 各ユーザーにサンプルモデルを分散して作成
  for (let i = 0; i < sampleModels.length; i++) {
    const user = createdUsers[i % createdUsers.length]
    const modelData = sampleModels[i]
    
    const model = await prisma.model.create({
      data: {
        userId: user.id,
        title: modelData.title,
        description: modelData.description,
        inputType: modelData.inputType,
        inputData: modelData.inputData,
        status: modelData.status,
        modelUrl: modelData.modelUrl,
        previewUrl: modelData.previewUrl,
        tripoTaskId: modelData.tripoTaskId,
      },
    })
    
    console.log('🎨 Created sample model:', { 
      title: model.title, 
      user: user.name, 
      status: model.status 
    })
  }

  console.log('✅ Seed completed successfully!')
  console.log('\n📋 Created accounts:')
  console.log(`👨‍💼 Admin: ${adminEmail} / ${adminPassword}`)
  console.log('👥 Test Users:')
  testUsers.forEach(user => {
    console.log(`   ${user.email} / ${user.password} (${user.name})`)
  })
  console.log('\n🚀 You can now start the application!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })