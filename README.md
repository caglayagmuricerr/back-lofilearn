# ▶︎ •၊၊||၊|။| Lofi Learn 

Bursa Teknik Üniversitesi öğrencileri ve öğretmenleri için bir interaktif quiz platformudur. 

Arka planda lo-fi müzikler eşliğinde keyifli bir öğrenme deneyimi sunar.

## API Routeları

#### Authentication Routeları (/api/auth)

| Metot    | Endpoint    | Açıklama               |
| :-------- | :-------    | :------------------------- |
| `POST`    | `/register`    | Yeni kullanıcı kaydı (BTÜ mail kontrolü)|
| `POST`    | `/login`    | Kullanıcı girişi ve JWT token oluşturma |
| `POST`    | `/logout`    | Kullanıcı çıkışı ve cookie temizleme (auth gerekli) |
| `POST`    | `/send-verification-otp`    | Email doğrulama OTP gönderme (auth gerekli) |
| `POST`    | `/verify-email`    | Email OTP ile doğrulama (auth gerekli) |
| `PATCH`   | `/change-password`    | Eski şifre ile yeni şifre değiştirme (auth gerekli) |
| `POST`    | `/send-reset-password-otp`    | Şifre sıfırlama OTP gönderme (mail ile) |
| `POST`    | `/reset-password`    | OTP ile şifre sıfırlama |

#### Quiz Routeları (/api/quizzes)

| Metot    | Endpoint    | Açıklama               |
| :-------- | :-------    | :------------------------- |
| `GET`    | `/`    | createdBy(öğretmen) id'sine göre quiz'leri getirme |
| `POST`    | `/`    | Yeni sorular ve quiz oluşturma (sadece öğretmen) |
| `GET`    | `/student/:userId`    | Öğrencinin katıldığı quizleri getirme (auth gerekli) |
| `POST`    | `/byIds`    | Birden fazla quiz ID'si ile quizleri getirme |
| `GET`    | `/my-quizzes`    | Öğretmenin oluşturduğu quizleri getirme (auth gerekli) |
| `POST`    | `/upload-image`    | Sorular için resim yükleme (auth gerekli) |
| `POST`    | `/invite-all/:quizId`    | Tüm öğrencileri belirli bir quize davet etme (sadece öğretmen) |

#### User Routeları (/api/users)

| Metot    | Endpoint    | Açıklama               |
| :-------- | :-------    | :------------------------- |
| `GET`    | `/`    | Oturum açmış kullanıcının bilgilerini getirme (auth gerekli) |

#### Suggestion Routeları (/api/suggestions)

| Metot    | Endpoint    | Açıklama               |
| :-------- | :-------    | :------------------------- |
| `POST`    | `/`    | Yeni öneri/geri bildirim oluşturma (auth gerekli) |

## Socket.IO Eventleri

♡ Client to Server Eventleri

#### Bağlantı ve Lobi Yönetimi

| Event    | Parametreler    | Açıklama              | Erişim       |
| :-------- | :-------    | :------------------------- | :-------------|
| `join-lobby`    | `{inviteCode}`    | Davet koduyla bir lobiye katılma | Tüm kullanıcılar |

#### Quiz Yönetimi

| Event    | Parametreler    | Açıklama              | Erişim       |
| :-------- | :-------    | :------------------------- | :-------------|
| `start-quiz`    | `{inviteCode}`    | Quiz'i başlatma | Sadece öğretmen |
| `submit-answer`    | `{questionId, answer, timeRemaining}`    | Cevap gönderme | Sadece öğrenci |

♡ Server to Client Eventleri

#### Lobi Eventleri

| Event    | Data    | Açıklama              | 
| :-------- | :-------    | :------------------------- |
| `lobby-update`    | `{players: Player[], message: string}`    | Lobideki oyuncu listesi ve mesaj gönderme | 

#### Quiz Eventleri

| Event    | Data   | Açıklama              | 
| :-------- | :-------    | :------------------------- |
| `quiz-started`    | `{totalQuestions: number}`    | Quiz başladı bilgilendirmesi | 
| `new-question` | `{question: Question, questionIndex: number, timeLimit: number}`| Yeni soru gönderme |
| `time-update` | `{timeLeft : number}` | Kalan süreyi güncelleme|
| `question-ended` | `{correctAnswer: number, scores: Record<string, number>}` | Soru bitince doğru cevap ve skorlar |
| `quiz-ended` | `{finalScores: Record<string, number>}` | Quiz bitiminde final skorları

#### Error Eventleri

| Event    | Data   | Açıklama              | 
| :-------- | :-------    | :------------------------- |
| `error`    | `{message:string}`    | Hata mesajı gönderme | 

#### Built-in Socket Eventleri

| Event    | Açıklama              | 
| :-------- | :------------------------- |
| `connection`    | Kullanıcı bağlandığında tetiklenir | 
| `new-question` | Kullanıcı bağlantısını kestiğinde tetiklenir |
| `time-update` | Kullanıcı bağlantıyı kesmeden önce tetiklenir (lobi temizleme için) |

## Environment Variables

Bu projeyi çalıştırmak için `.env` dosyanıza aşağıdaki ortam değişkenlerini eklemeniz gerekiyor

`NODE_ENV`

`MONGODB_URI`

`JWT_SECRET`

`SMTP_HOST`

`SMTP_USER`

`SMTP_PASS`

`SMTP_PORT`

`SENDER_EMAIL`

`FRONTEND_URL`

❤︎ Testleri çalıştırmak için ayrı bir `.env.test` dosyası oluşturup `NODE_ENV` değişkenine `test` değerini vermeniz gerekiyor.

Tüm testleri çalıştırma
```sh
npm run test
```

Belirli bir testi çalıştırma (auth örnek)
```sh
npm run test:auth
```

![password reset](https://i.imgur.com/WA5Fubj.png)
![forgotten password](https://i.imgur.com/nz0YphC.png)
