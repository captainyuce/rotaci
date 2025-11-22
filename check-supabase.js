// Supabase bağlantısını test et
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl ? '✅ Var' : '❌ Yok');
console.log('Supabase Key:', supabaseKey ? '✅ Var' : '❌ Yok');

if (supabaseUrl && supabaseKey) {
    console.log('\n✅ Environment variables doğru ayarlanmış!');
} else {
    console.log('\n❌ Environment variables eksik!');
    console.log('Lütfen .env.local dosyasını kontrol edin.');
}
