const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Yerelde test ederken .env dosyasını yükler

const app = express();
// Render, PORT'u otomatik ayarlar. Yerelde 3000 kullanır.
const PORT = process.env.PORT || 3000; 

// Express'in JSON formatındaki istek gövdesini (request body) işlemesini sağlar
app.use(express.json());

// =========================================================
//                   API VE AYARLAR
// =========================================================

// KRİTİK: AUTH_TOKEN'i Render'da (veya yerelde) Ortam Değişkeni olarak tanımlamanız GEREKİR.
const AUTH_TOKEN = process.env.AUTH_TOKEN; 
const API_URL = "https://sfapi.pazaramatatil.com/card/point/v2";

// Token Kontrolü (Başlatma öncesi)
if (!AUTH_TOKEN || !AUTH_TOKEN.startsWith('Bearer ')) {
    console.error("HATA: AUTH_TOKEN ortam değişkeni tanımlı değil veya 'Bearer ' ile başlamıyor.");
    // Render üzerinde bu hata uygulamanın başarısız olmasına neden olur.
    // process.exit(1); 
}


// İletilen tüm Başlıklar (HEADERS) - Authorization başlığı dinamik olarak ayarlanacak.
const HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "tr-TR,tr;q=0.8",
    // Authorization token'ı her istekte güncellenecektir.
    "Channelcode": "12",
    "Content-Type": "application/json",
    "OrderType": "15",
    "Origin": "https://www.pazaramatatil.com",
    "Referer": "https://www.pazaramatatil.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
    "X-Channelcode": "12"
};

// İstek Gövdesinin Sabit Kısmı (Payload)
const SABIT_PAYLOAD_VERILERI = {
    "PointType": 1,
    "CardInfo": {
        "ExpMonth": "11",
        "ExpYear": "2028",
        "CvcNumber": "000"
    }
};

// =========================================================
//                      ANA FONKSİYON
// =========================================================

async function apiIstegiAt(kartNumarasi) {
    const payload = JSON.parse(JSON.stringify(SABIT_PAYLOAD_VERILERI));
    payload.CardInfo.CardNumber = kartNumarasi;

    // Authorization başlığını her istek için HEADER'lara ekleyelim
    const requestHeaders = {
        ...HEADERS,
        "Authorization": AUTH_TOKEN 
    };

    try {
        const response = await axios.post(API_URL, payload, { 
            headers: requestHeaders, 
            timeout: 15000 
        });

        const durumKodu = response.status;
        const responseData = response.data;

        if (durumKodu === 200 && responseData.success) {
            
            const pointValue = responseData.data?.point?.value || 0;
            const pointValueString = responseData.data?.point?.valueString || "0,00 TL";
            
            return {
                success: true,
                kart_no: kartNumarasi,
                puan_var: pointValue > 0,
                puan_miktar: pointValueString,
                // raw_response: responseData // Ham yanıtı göndermek isterseniz açın
            };

        } else {
            return {
                success: false,
                kart_no: kartNumarasi,
                hata_mesaji: "API İş Mantığı Hatası",
                detay: responseData.message || "Bilinmeyen API hatası",
                http_status: durumKodu
            };
        }

    } catch (error) {
        return {
            success: false,
            kart_no: kartNumarasi,
            hata_mesaji: "İletişim/Ağ Hatası",
            detay: error.response 
                ? `Sunucu Hata Kodu: ${error.response.status}` 
                : (error.code === 'ECONNABORTED' ? 'Zaman Aşımı' : 'Ağ Bağlantı Hatası')
        };
    }
}

// =========================================================
//                   EXPRESS API ENDPOINT
// =========================================================

// POST rotası: Kart numarasını al ve sorgulama yap
app.post('/api/check', async (req, res) => {
    
    const kartNumarasi = req.body.kart_no;

    if (!kartNumarasi || typeof kartNumarasi !== 'string' || kartNumarasi.length < 15) {
        return res.status(400).json({ 
            success: false, 
            message: "Hata: Geçerli bir 'kart_no' alanı (en az 15 karakter) sağlanmalıdır." 
        });
    }

    console.log(`[LOG] Yeni istek alındı. Kart No: ${kartNumarasi.slice(0, 4)}...`);

    const sonuc = await apiIstegiAt(kartNumarasi);

    if (sonuc.success) {
        res.status(200).json(sonuc);
    } else {
        // Hatalı yanıtlar için uygun HTTP kodu (500 veya 400 serisi) dönülebilir.
        // Genellikle 500 (Server Error) kullanılır.
        res.status(500).json(sonuc);
    }
});

// Temel kontrol (Root) rotası
app.get('/', (req, res) => {
    res.send('API çalışıyor. Sorgulama için POST /api/check adresini kullanın.');
});

// Sunucuyu Başlat
app.listen(PORT, () => {
    console.log(`✅ API başlatıldı. Dinleniyor: Port ${PORT}`);
});