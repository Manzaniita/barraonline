import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Sembrando base de datos de producción en Supabase...')

  // 1. Crear o actualizar Tenant Demo
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-club' },
    update: {
      name: 'Club Nocturno Palermo',
      themeConfig: {
        primaryColor: '#8b5cf6',
        primaryHover: '#7c3aed',
        secondaryColor: '#ec4899',
        backgroundColor: '#0a0a0c',
        cardBackground: '#13131a',
        textColor: '#f8fafc',
        nightclubName: 'Club Nocturno Palermo',
        tagline: 'Barra Rápida QR • Cero Colas',
      },
    },
    create: {
      slug: 'demo-club',
      name: 'Club Nocturno Palermo',
      themeConfig: {
        primaryColor: '#8b5cf6',
        primaryHover: '#7c3aed',
        secondaryColor: '#ec4899',
        backgroundColor: '#0a0a0c',
        cardBackground: '#13131a',
        textColor: '#f8fafc',
        nightclubName: 'Club Nocturno Palermo',
        tagline: 'Barra Rápida QR • Cero Colas',
      },
      feePercentage: 0.0,
      defaultExpirationHour: '07:00',
    },
  })

  console.log(`✅ Tenant verificado: ${tenant.name} (${tenant.slug}) [ID: ${tenant.id}]`)

  // 2. Sembrar Productos
  const productsData = [
    {
      name: 'Fernet Branca con Coca 750ml',
      description: 'Vaso térmico gigante con hielo cristal y abundante Branca.',
      category: 'Tragos',
      price: 6500,
      stockAvailable: 300,
    },
    {
      name: 'Gin Tonic Bombay Sapphire',
      description: 'Ginebra importada, agua tónica premium y rodaja de limón.',
      category: 'Tragos',
      price: 7500,
      stockAvailable: 200,
    },
    {
      name: 'Campari Orange',
      description: 'Campari con jugo de naranja natural y rodaja de naranja.',
      category: 'Tragos',
      price: 6000,
      stockAvailable: 150,
    },
    {
      name: 'Vodka Smirnoff + Speed',
      description: '⚡ Promo Canje Rápido: retirar antes de las 02:30 AM.',
      category: 'Tragos',
      price: 5500,
      stockAvailable: 100,
      redeemDeadlineTime: '02:30',
    },
    {
      name: 'Cerveza Corona 330ml',
      description: 'Porrón helado con gajo de lima.',
      category: 'Cervezas',
      price: 4000,
      stockAvailable: 400,
    },
    {
      name: 'Cerveza Patagonia Amber Lager 710ml',
      description: 'Botella compartible bien fría.',
      category: 'Cervezas',
      price: 5500,
      stockAvailable: 200,
    },
    {
      name: 'Combo Absolut + 4 Speed XL',
      description: 'Botella 750ml + 4 latas de Speed + balde de hielo.',
      category: 'Combos',
      price: 38000,
      stockAvailable: 50,
    },
    {
      name: 'Combo Jägermeister + 6 Red Bull',
      description: 'Botella 700ml + 6 Red Bull + balde de hielo.',
      category: 'Combos',
      price: 49000,
      stockAvailable: 35,
    },
    {
      name: 'Agua Mineral Kin con o sin gas 500ml',
      description: 'Hidratación obligatoria para toda la noche.',
      category: 'Sin Alcohol',
      price: 2000,
      stockAvailable: 500,
    },
    {
      name: 'Red Bull Energy Drink 250ml',
      description: 'Lata clásica fría.',
      category: 'Sin Alcohol',
      price: 3500,
      stockAvailable: 250,
    },
  ]

  for (const prod of productsData) {
    const existing = await prisma.product.findFirst({
      where: { tenantId: tenant.id, name: prod.name },
    })

    if (!existing) {
      await prisma.product.create({
        data: {
          tenantId: tenant.id,
          name: prod.name,
          description: prod.description,
          category: prod.category,
          price: prod.price,
          stockAvailable: prod.stockAvailable,
          redeemDeadlineTime: prod.redeemDeadlineTime || null,
          isActive: true,
        },
      })
    }
  }

  console.log(`✅ ${productsData.length} productos sembrados en la base de datos.`)

  // 3. Crear Usuarios de Staff para la Barra
  await prisma.user.upsert({
    where: { authProviderId: 'staff-bartender-01' },
    update: {},
    create: {
      authProviderId: 'staff-bartender-01',
      tenantId: tenant.id,
      fullName: 'Bartender Barra Principal',
      dni: '11111111',
      role: 'BARTENDER',
    },
  })

  await prisma.user.upsert({
    where: { authProviderId: 'staff-admin-01' },
    update: {},
    create: {
      authProviderId: 'staff-admin-01',
      tenantId: tenant.id,
      fullName: 'Encargado General',
      dni: '22222222',
      role: 'CLUB_ADMIN',
    },
  })

  console.log('✅ Usuarios de Staff creados (Bartender y Admin).')
  console.log('🎉 Base de datos de Supabase inicializada y lista al 100% 🚀')
}

main()
  .catch((e) => {
    console.error('Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
