# 🕵️‍♂️ دليل بوت التداول الآلي المتخفي (Stealth Auto-Trader) لـ Pocket Option

نظام تداول آلي عالي التخفي مبني بلغة Python، مصمم لمحاكاة السلوك البشري الطبيعي 100% والتصدي لأنظمة كشف البوتات (Anti-Bot & Behavioral Detection).

---

## 📂 1. هيكل المجلدات والملفات (Directory Structure)

```text
python/stealth_trader/
├── __init__.py           # تعريف الحزمة
├── config.py             # ملف الإعدادات وإدارة المخاطر والبروكسي
├── human_emulator.py     # كلاس محاكاة السلوك البشري (تردد، تنويع المبالغ، راحة، ماوس بيزييه)
├── network_evasion.py    # طبقة التخفي الشبكي وبصمة متصفح كروم الحقيقية (TLS/curl_cffi)
├── risk_manager.py       # إدارة المخاطر المالية (حد الخسارة اليومي، هدف الربح، عمق المارتينجال)
├── connection.py         # مدير اتصال WebSocket لـ Pocket Option ونبضات Keep-Alive
├── main.py               # المشغل الرئيسي المنسق لجميع الطبقات
└── README.md             # دليل الاستخدام والتشغيل
```

---

## ⚙️ 2. شرح الطبقات الهندسية والتنفيذ

### 1. طبقة محاكاة السلوك البشري (Human Emulation Layer)
- **أ. تردد الدخول البشري (Human Hesitation)**:
  تم دمج الكود المطلوب حرفياً، حيث يتم إيقاف التنفيذ عشوائياً بين `1.5` إلى `4.2` ثانية قبل تنفيذ أي صفقة:
  ```python
  import time
  import random

  # تأخير عشوائي بين 1.5 إلى 4.2 ثانية قبل دخول الصفقة لمحاكاة التردد البشري
  time.sleep(random.uniform(1.5, 4.2))
  ```
  كما يوفر كلاس `HumanEmulator` النسخة غير المتزامنة `apply_human_hesitation()` للحفاظ على استمرارية مهام الـ WebSocket دون تجميدها.
- **ب. عشوائية حجم الصفقة (Randomized Amounts)**:
  منع البصمات الثابتة (مثل تكرار 10$ بالضبط). دالة `randomize_trade_amount()` تضيف تموجات سنتية واقعية (مثل `$10.15` أو `$9.85` أو `$10.30`).
- **ج. فترات الراحة وإدارة الإجهاد (Fatigue & Rest Breaks)**:
  بعد كل 10 صفقات، يدخل البوت تلقائياً في استراحة بشرية طبيعية بين `15` إلى `45` دقيقة لمحاكاة متداول حقيقي ترك الشاشة.
- **د. محاكاة حركة الماوس المنحنية (Cubic Bezier Curves)**:
  دالة `generate_bezier_trajectory()` تولد مسارات منحنية واقعية بنقاط بيزييه مع اهتزازات طبيعية (Micro-Jitter) وتأخير نقر بين `200ms` إلى `500ms`.

### 2. طبقة الاتصال وإدارة الجلسة (Connection Layer)
- **التحقق الصارم من SSID**: دالة `SSIDValidator.format_auth_packet()` تفحص الـ SSID وتضمن بناء حزمة Socket.IO v4 الرسمية:
  `42["auth", {"session": "...", "isDemo": 1, "uid": 0, "platform": 2}]`.
- **إبقاء الجلسة حية (Keep-Alive)**: إرسال نبضات دورية (`42["ping"]` و Engine.IO `2`) كل 25 ثانية لمنع الخادم من قطع الجلسة.
- **إعادة الاتصال الذاتي (Auto-Reconnect)**: 3 محاولات كل 5 ثوانٍ، وإذا استمر الرفض أو ظهر `NotAuthorized` يتم التحول تلقائياً للوضع التجريبي (`isDemo: 1`) لضمان عدم توقف الإشارات.

### 3. طبقة التخفي الشبكي (Network Evasion Layer)
- استخدام `curl_cffi` مع `impersonate="chrome"` لمحاكاة بصمة TLS الحقيقية لمتصفح Chrome (JA3/JA4 fingerprinting).
- دعم البروكسيات السكنية (`Residential Proxies`) عبر بروتوكولات SOCKS5 و HTTP.

### 4. إدارة المخاطر (Risk Management)
- **Stop-Loss يومي**: إيقاف فوري عند الوصول لأقصى خسارة مسموح بها.
- **Take-Profit يومي**: تأمين الأرباح وإيقاف الصفقات عند تحقيق الهدف.
- **سقف المارتينجال**: حد أقصى للعمق (مثلاً مضاعفتين كحد أقصى) لحماية الحساب من التصفير.

---

## 🚀 3. خطوات التشغيل على سيرفر Linux / VPS أو Termux

### التثبيت:
```bash
pip install websockets requests
# اختياري لتفعيل بصمة كروم TLS الحقيقية:
pip install curl_cffi
```

### التشغيل المباشر:
```bash
cd python/stealth_trader
python3 main.py "YOUR_POCKET_OPTION_SSID"
```

أو عبر متغيرات البيئة:
```bash
export POCKET_OPTION_SSID='42["auth",{"session":"YOUR_TOKEN_HERE","isDemo":1,"uid":0,"platform":2}]'
export IS_DEMO=1
export TRADING_ASSET="EURUSD_otc"
export RESIDENTIAL_PROXY="socks5://user:pass@proxy-ip:port"
python3 main.py
```
