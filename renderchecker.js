const express = require('express');
const axios = require('axios');
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(express.json());

// =========================================================
//                   API VE AYARLAR
// =========================================================

const AUTH_TOKEN = process.env.AUTH_TOKEN; 
const API_URL = "https://sfapi.pazaramatatil.com/card/point/v2";

if (!AUTH_TOKEN || !AUTH_TOKEN.startsWith('Bearer ')) {
    console.error("HATA: AUTH_TOKEN ortam değişkeni tanımlı değil veya 'Bearer ' ile başlamıyor.");
}

const HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "tr-TR,tr;q=0.8",
    "Channelcode": "12",
    "Content-Type": "application/json",
    "OrderType": "15",
    "Origin": "https://www.pazaramatatil.com",
    "Referer": "https://www.pazaramatatil.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
    "X-Channelcode": "12"
};

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
//                   YENİ URL PARAMETRELİ GET ENDPOINT'İ
// =========================================================
// KULLANIM: GET https://.../api/check-url?kart_no=1234...
app.get('/api/check-url', async (req, res) => {
    
    // Kart numarasını URL'deki sorgu parametresinden (req.query) alıyoruz.
    const kartNumarasi = req.query.kart_no; 

    if (!kartNumarasi || typeof kartNumarasi !== 'string' || kartNumarasi.length < 15) {
        return res.status(400).json({ 
            success: false, 
            message: "Hata: Geçerli bir 'kart_no' URL parametresi sağlanmalıdır (örnek: ?kart_no=...).",
            tip: "URL parametresi eksik veya hatalı."
        });
    }

    console.log(`[LOG] Yeni GET isteği alındı. Kart No: ${kartNumarasi.slice(0, 4)}...`);

    const sonuc = await apiIstegiAt(kartNumarasi);

    if (sonuc.success) {
        res.status(200).json(sonuc);
    } else {
        res.status(500).json(sonuc);
    }
});


// =========================================================
//                   ESKİ GÜVENLİ POST ENDPOINT'İ (KORUNDU)
// =========================================================
// KULLANIM: POST https://.../api/check (Body: {"kart_no": "..."})
app.post('/api/check', async (req, res) => {
    
    // Kart numarasını HTTP Body'den (req.body) alıyoruz.
    const kartNumarasi = req.body.kart_no; 

    if (!kartNumarasi || typeof kartNumarasi !== 'string' || kartNumarasi.length < 15) {
        return res.status(400).json({ 
            success: false, 
            message: "Hata: Geçerli bir 'kart_no' body alanı sağlanmalıdır." 
        });
    }

    console.log(`[LOG] Yeni POST isteği alındı. Kart No: ${kartNumarasi.slice(0, 4)}...`);

    const sonuc = await apiIstegiAt(kartNumarasi);

    if (sonuc.success) {
        res.status(200).json(sonuc);
    } else {
        res.status(500).json(sonuc);
    }
});


// Temel kontrol (Root) rotası
app.get('/', (req, res) => {
    res.send('API çalışıyor. Sorgulama için POST /api/check veya GET /api/check-url?kart_no=... adreslerini kullanın.');
});

// Sunucuyu Başlat
app.listen(PORT, () => {
    console.log(`✅ API başlatıldı. Dinleniyor: Port ${PORT}`);
});
