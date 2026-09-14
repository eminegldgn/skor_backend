const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt'); // Şifre kontrolü için

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 📡 MONITOR: Flutter kapıyı çaldığı an terminale basar
app.use((req, res, next) => {
    console.log(`--> 📡 Flutter'dan istek geldi! Yol: ${req.url}`);
    next();
});

// WampServer bağlantısı
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'skor_merkezi_db'
});

db.connect((err) => {
    if (err) {
        console.error('Veritabanı bağlantı hatası: ' + err.message);
        return;
    }
    console.log('Wampserver MySQL Veritabanına başarıyla bağlanıldı! 🎉');
});

// 🎯 KENDİ GİRİŞ KAPIMIZ: Hiçbir 419 veya 302 hatasına takılmaz!
app.post('/api/login', (req, res) => {
    const { email, sifre } = req.body;

    if (!email || !sifre) {
        return res.status(400).json({ message: 'E-posta ve şifre gereklidir!' });
    }

    // Orijinal User.php modelindeki 'e_mail' sütununa göre arama yapıyoruz
    const sql = 'SELECT * FROM users WHERE e_mail = ?';
    db.query(sql, [email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Veritabanı hatası!' });
        if (results.length === 0) return res.status(404).json({ message: 'Kullanıcı bulunamadı!' });

        const kullanici = results[0];

        try {
            // Laravel'in Bcrypt şifre hash formatını Node.js ile uyumlu hale getirip doğruluyoruz
            const temizHash = kullanici.password.replace(/^\$2y\$/, '$2b$');
            const sifreDogruMu = await bcrypt.compare(sifre, temizHash);

            if (!sifreDogruMu) {
                return res.status(400).json({ message: 'Hatalı şifre girdiniz!' });
            }

            // Giriş başarılıysa kullanıcı bilgilerini JSON olarak Flutter'a uçuruyoruz
            res.status(200).json({
                status: 'success',
                message: 'Giriş başarılı',
                user: { id: kullanici.id, name_surname: kullanici.name_surname, e_mail: kullanici.e_mail }
            });

        } catch (hata) {
            res.status(500).json({ message: 'Şifre doğrulama esnasında hata oluştu.' });
        }
    });
});

// 🎯 CANLI MAÇLARI GETİREN VERİ KAPIMIZ
app.get('/api/canli-maclar', (req, res) => {
    const sql = `
      SELECT 
        g.*, 
        t1.team_name AS team_name1, 
        t2.team_name AS team_name2
      FROM games g
      LEFT JOIN teams t1 ON g.team1 = t1.id
      LEFT JOIN teams t2 ON g.team2 = t2.id
      ORDER BY g.id DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json(results);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu 3000 portunda giriş ve maç istekleri için hazır...`);
});


