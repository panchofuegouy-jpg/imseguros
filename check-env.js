// Script para verificar las variables de entorno necesarias
// Ejecutar con: node check-env.js

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
  'SUPABASE_SERVICE_ROLE_KEY'
];

console.log('🔍 Verificando variables de entorno...\n');

let allPresent = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    // Mostrar solo los primeros y últimos caracteres para seguridad
    const masked = value.length > 10 
      ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
      : '***';
    console.log(`✅ ${varName}: ${masked}`);
  } else {
    console.log(`❌ ${varName}: NO CONFIGURADA`);
    allPresent = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPresent) {
  console.log('🎉 Todas las variables están configuradas!');
} else {
  console.log('⚠️  Faltan variables de entorno.');
  console.log('📝 Crea un archivo .env.local con las variables faltantes.');
  console.log('📋 Usa .env.local.example como referencia.');
}

console.log('\n📖 Para obtener estas variables:');
console.log('🔸 Supabase: https://supabase.com/dashboard/project/[tu-proyecto]/settings/api');
console.log('🔸 Resend: https://resend.com/api-keys');
