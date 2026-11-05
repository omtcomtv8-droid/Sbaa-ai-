import { Language } from './types';

export interface TermTranslation {
  en: string;
  ar: string;
  ru: string;
  [lang: string]: string | undefined;
}

export const TECHNICAL_TERMINOLOGY: Record<string, TermTranslation> = {
  // Signal Directions
  UP: { en: 'UP', ar: 'صعود', ru: 'ВВЕРХ' },
  DOWN: { en: 'DOWN', ar: 'هبوط', ru: 'ВНИЗ' },
  WAIT: { en: 'WAIT', ar: 'انتظار', ru: 'ОЖИДАНИЕ' },
  BUY: { en: 'BUY', ar: 'شراء', ru: 'ПОКУПКА' },
  SELL: { en: 'SELL', ar: 'بيع', ru: 'ПРОДАЖА' },

  // Market Bias
  Bullish: { en: 'Bullish', ar: 'صاعد', ru: 'Бычий' },
  Bearish: { en: 'Bearish', ar: 'هابط', ru: 'Медвежий' },
  Neutral: { en: 'Neutral', ar: 'محايد', ru: 'Нейтральный' },
  BULLISH: { en: 'BULLISH', ar: 'صاعد', ru: 'БЫЧИЙ' },
  BEARISH: { en: 'BEARISH', ar: 'هابط', ru: 'МЕДВЕЖИЙ' },
  NEUTRAL: { en: 'NEUTRAL', ar: 'محايد', ru: 'НЕЙТРАЛЬНЫЙ' },

  // Strategy & Signal Metrics
  Confidence: { en: 'Confidence', ar: 'نسبة الثقة', ru: 'Уверенность' },
  'Strategy Score': { en: 'Strategy Score', ar: 'نقاط الاستراتيجية', ru: 'Оценка стратегии' },
  Confluence: { en: 'Confluence', ar: 'التوافق الفني', ru: 'Конфлюэнция' },
  'Net Score': { en: 'Net Score', ar: 'النتيجة الصافية', ru: 'Чистая оценка' },
  Strength: { en: 'Strength', ar: 'القوة', ru: 'Сила' },

  // Strategy Catalog Meta Names
  'EMA Crossover & Trend': { en: 'EMA Crossover & Trend', ar: 'تقاطع واتجاه المتوسطات الأسية (EMA)', ru: 'Пересечение и тренд EMA' },
  'SMA Crossover': { en: 'SMA Crossover', ar: 'تقاطع المتوسطات البسيطة (SMA)', ru: 'Пересечение SMA' },
  'Moving Average Alignment': { en: 'Moving Average Alignment', ar: 'تراصف المتوسطات المتحركة', ru: 'Выравнивание скользящих средних' },
  'RSI Momentum': { en: 'RSI Momentum', ar: 'زخم القوة النسبية (RSI)', ru: 'Импульс RSI' },
  'RSI Reversal & Reversion': { en: 'RSI Reversal & Reversion', ar: 'انعكاس وارتداد القوة النسبية (RSI)', ru: 'Разворот и возврат RSI' },
  'MACD Crossover': { en: 'MACD Crossover', ar: 'تقاطع مؤشر الماكد (MACD)', ru: 'Пересечение MACD' },
  'Bollinger Mean Reversion': { en: 'Bollinger Mean Reversion', ar: 'الارتداد المتوسط لبولينجر', ru: 'Возврат к средней Боллинджера' },
  'Stochastic Oscillator': { en: 'Stochastic Oscillator', ar: 'مذبذب ستوكاستيك (Stochastic)', ru: 'Осциллятор Стохастик' },
  'CCI Trend Oscillator': { en: 'CCI Trend Oscillator', ar: 'مذبذب قناة السلع (CCI)', ru: 'Трендовый осциллятор CCI' },
  'ADX Trend Strength': { en: 'ADX Trend Strength', ar: 'قوة الاتجاه (ADX)', ru: 'Сила тренда ADX' },
  'Parabolic SAR Acceleration': { en: 'Parabolic SAR Acceleration', ar: 'تسارع بارابوليك سار (Parabolic SAR)', ru: 'Ускорение Parabolic SAR' },
  'Ichimoku Cloud Tenkan/Kijun': { en: 'Ichimoku Cloud Tenkan/Kijun', ar: 'سحابة إيشيموكو (تيكنان / كيجون)', ru: 'Облако Ишимоку Тенкан/Киджун' },
  'Candlestick Patterns': { en: 'Candlestick Patterns', ar: 'نماذج الشموع اليابانية', ru: 'Свечные паттерны' },
  'Support & Resistance Zones': { en: 'Support & Resistance Zones', ar: 'مناطق الدعم والمقاومة', ru: 'Зоны поддержки и сопротивления' },
  'ATR Volatility Breakout': { en: 'ATR Volatility Breakout', ar: 'اختراق التقلب (ATR)', ru: 'Пробой волатильности ATR' },
  'Market Structure & Swings': { en: 'Market Structure & Swings', ar: 'هيكل السوق والقمم والقيعان', ru: 'Структура рынка и свинги' },
  'Pivot Points (Classic Floor)': { en: 'Pivot Points (Classic Floor)', ar: 'نقاط البيفوت الكلاسيكية', ru: 'Классические точки Pivot' },
  'Fibonacci Retracement (61.8%)': { en: 'Fibonacci Retracement (61.8%)', ar: 'تصحيح فيبوناتشي (61.8%)', ru: 'Уровни Фибоначчи (61.8%)' },
  'Institutional Price Action': { en: 'Institutional Price Action', ar: 'حركة السعر المؤسسية', ru: 'Институциональный Price Action' },
  'ATR Volatility Expansion': { en: 'ATR Volatility Expansion', ar: 'توسع التقلب (ATR)', ru: 'Расширение волатильности ATR' },
  'W.D. Gann Price/Time Analysis': { en: 'W.D. Gann Price/Time Analysis', ar: 'تحليل السعر والزمن لدبليو دي جان', ru: 'Анализ цены и времени В.Д. Ганна' },
  'Ralph Nelson Elliott Wave': { en: 'Ralph Nelson Elliott Wave', ar: 'موجات رالف نيلسون إليوت', ru: 'Волны Ральфа Нельсона Эллиотта' },
  'Nicolas Darvas Box Strategy': { en: 'Nicolas Darvas Box Strategy', ar: 'استراتيجية صناديق نيكولاس دارفاس', ru: 'Стратегия коробок Николаса Дарваса' },
  'Multi-Timeframe Confluence': { en: 'Multi-Timeframe Confluence', ar: 'التوافق متعدد الأطر الزمنية', ru: 'Мультитаймфрейм конфлюэнция' },
  'Multi-Strategy Confluence': { en: 'Multi-Strategy Confluence', ar: 'التوافق متعدد الاستراتيجيات', ru: 'Мультистратегическая конфлюэнция' },

  // Strategy Categories
  'Oscillator': { en: 'Oscillator', ar: 'مذبذب', ru: 'Осциллятор' },
  'Multi-Timeframe': { en: 'Multi-Timeframe', ar: 'أطر متعددة', ru: 'Мультитаймфрейм' },
  'Price Action': { en: 'Price Action', ar: 'حركة السعر', ru: 'Price Action' },
  'ALL': { en: 'ALL', ar: 'الكل', ru: 'ВСЕ' },

  // Candle Patterns
  'Bullish Engulfing': { en: 'Bullish Engulfing', ar: 'ابتلاع شرائي صاعد', ru: 'Бычье поглощение' },
  'Bearish Engulfing': { en: 'Bearish Engulfing', ar: 'ابتلاع بيعي هابط', ru: 'Медвежье поглощение' },
  'Hammer': { en: 'Hammer', ar: 'شمعة المطرقة', ru: 'Молот' },
  'Inverted Hammer': { en: 'Inverted Hammer', ar: 'المطرقة المقلوبة', ru: 'Перевернутый молот' },
  'Shooting Star': { en: 'Shooting Star', ar: 'شمعة الشهاب الساقط', ru: 'Падающая звезда' },
  'Doji': { en: 'Doji', ar: 'شمعة دوجي (توازن وتردد)', ru: 'Доджи' },
  'Morning Star': { en: 'Morning Star', ar: 'شمعة نجم الصباح', ru: 'Утренняя звезда' },
  'Evening Star': { en: 'Evening Star', ar: 'شمعة نجم المساء', ru: 'Вечерняя звезда' },
  'Piercing Line': { en: 'Piercing Line', ar: 'الخط الثاقب', ru: 'Просвет в облаках' },
  'Dark Cloud Cover': { en: 'Dark Cloud Cover', ar: 'السحابة القاتمة', ru: 'Темное облако' },
  'Pinbar': { en: 'Pinbar', ar: 'شمعة بن بار (رفض سعري)', ru: 'Пинбар' },
  'No Pattern': { en: 'No Pattern', ar: 'لا يوجد نموذج محدد', ru: 'Без паттерна' },

  // Candle Attributes
  Candle: { en: 'Candle', ar: 'شمعة', ru: 'Свеча' },
  Candles: { en: 'Candles', ar: 'شموع', ru: 'Свечи' },
  Open: { en: 'Open', ar: 'افتتاح', ru: 'Открытие' },
  High: { en: 'High', ar: 'أعلى', ru: 'Максимум' },
  Low: { en: 'Low', ar: 'أدنى', ru: 'Минимум' },
  Close: { en: 'Close', ar: 'إغلاق', ru: 'Закрытие' },
  Timeframe: { en: 'Timeframe', ar: 'الإطار الزمني', ru: 'Таймфрейм' },
  'Current Price': { en: 'Current Price', ar: 'السعر الحالي', ru: 'Текущая цена' },

  // Technical Concepts
  'Market Structure': { en: 'Market Structure', ar: 'هيكل السوق', ru: 'Структура рынка' },
  Support: { en: 'Support', ar: 'دعم', ru: 'Поддержка' },
  Resistance: { en: 'Resistance', ar: 'مقاومة', ru: 'Сопротивление' },
  Breakout: { en: 'Breakout', ar: 'اختراق', ru: 'Пробой' },
  Pullback: { en: 'Pullback', ar: 'ارتداد', ru: 'Откат' },
  Momentum: { en: 'Momentum', ar: 'الزخم', ru: 'Импульс' },
  Trend: { en: 'Trend', ar: 'الاتجاه', ru: 'Тренд' },
  Volatility: { en: 'Volatility', ar: 'التقلب', ru: 'Волатильность' },

  // System & Connection States
  Authentication: { en: 'Authentication', ar: 'المصادقة', ru: 'Аутентификация' },
  Connection: { en: 'Connection', ar: 'الاتصال', ru: 'Подключение' },
  Live: { en: 'Live', ar: 'مباشر', ru: 'В реальном времени' },
  Stale: { en: 'Stale', ar: 'غير محدث', ru: 'Устаревшие данные' },
  Unavailable: { en: 'Unavailable', ar: 'غير متاح', ru: 'Недоступно' },
  Connected: { en: 'Connected', ar: 'متصل', ru: 'Подключено' },
  Disconnected: { en: 'Disconnected', ar: 'غير متصل', ru: 'Отключено' },
  Authenticating: { en: 'Authenticating', ar: 'جارٍ التحقق والمصادقة', ru: 'Аутентификация' },
  Authenticated: { en: 'Authenticated', ar: 'تمت المصادقة', ru: 'Аутентифицирован' },
  Loading: { en: 'Loading', ar: 'جارٍ التحميل', ru: 'Загрузка' },
  'Waiting for data': { en: 'Waiting for data', ar: 'في انتظار وصول البيانات', ru: 'Ожидание данных' },
  'Insufficient candles': { en: 'Insufficient candles', ar: 'عدد الشموع غير كافٍ', ru: 'Недостаточно свечей' },
  'Invalid candle data': { en: 'Invalid candle data', ar: 'بيانات الشموع غير صالحة', ru: 'Неверные данные свечей' },
  'Authentication failed': { en: 'Authentication failed', ar: 'فشلت المصادقة', ru: 'Сбой аутентификации' },
  'Not authorized': { en: 'Not authorized', ar: 'غير مصرح به', ru: 'Не авторизован' },
  'Analysis started': { en: 'Analysis started', ar: 'بدأ التحليل الكمي', ru: 'Анализ запущен' },
  'Analysis stopped': { en: 'Analysis stopped', ar: 'توقف التحليل الكمي', ru: 'Анализ остановлен' },
  'Signal generated': { en: 'Signal generated', ar: 'تم توليد إشارة فنية', ru: 'Сигнал сформирован' },
  'No valid setup': { en: 'No valid setup', ar: 'لا يوجد نموذج فني مكتمل', ru: 'Нет валидной формации' },
  'Strategy ready': { en: 'Strategy ready', ar: 'الاستراتيجية جاهزة', ru: 'Стратегия готова' },
  'Strategy locked': { en: 'Strategy locked', ar: 'الاستراتيجية مقفلة', ru: 'Стратегия заблокирована' },

  // Modes & Accounts
  DEMO: { en: 'DEMO', ar: 'تجريبي', ru: 'ДЕМО' },
  REAL: { en: 'REAL', ar: 'حقيقي', ru: 'РЕАЛЬНЫЙ' },
  'Demo Account': { en: 'Demo Account', ar: 'حساب تجريبي', ru: 'Демо-счет' },
  'Real Account': { en: 'Real Account', ar: 'حساب حقيقي', ru: 'Реальный счет' },

  // Specialized Structural & Quant Analysis
  EQUILIBRIUM: { en: 'Equilibrium (50%)', ar: 'نقطة التوازن (50%)', ru: 'Равновесие (50%)' },
  MAJOR_HIGH: { en: 'Major High', ar: 'قمة رئيسية', ru: 'Ключевой максимум' },
  MAJOR_LOW: { en: 'Major Low', ar: 'قاع رئيسي', ru: 'Ключевой минимум' },
  INTERMEDIATE: { en: 'Intermediate', ar: 'مستوى متوسط', ru: 'Промежуточный уровень' },
  'BOX CONFIRMED': { en: 'Box Confirmed', ar: 'صندوق مؤكد', ru: 'Коробка подтверждена' },
  'BOX FORMING': { en: 'Box Forming', ar: 'صندوق قيد التكوين', ru: 'Коробка формируется' },
  BREAKOUT_UP: { en: 'Breakout Up', ar: 'اختراق صاعد', ru: 'Пробой вверх' },
  BREAKDOWN_DOWN: { en: 'Breakdown Down', ar: 'كسر هابط', ru: 'Пробой вниз' },
  FAILED_BREAKOUT: { en: 'Failed Breakout', ar: 'اختراق كاذب', ru: 'Ложный пробой' },
  INSIDE: { en: 'Inside Range', ar: 'داخل النطاق', ru: 'Внутри диапазона' },
  FORMING: { en: 'Forming', ar: 'قيد التكوين', ru: 'Формируется' },
  CONFIRMED: { en: 'Confirmed', ar: 'مؤكد', ru: 'Подтверждено' },
  CLOSED: { en: 'Closed', ar: 'مغلقة', ru: 'Закрыта' },
  LIVE: { en: 'Live', ar: 'مباشر', ru: 'В эфире' },
  STALE: { en: 'Stale', ar: 'غير محدث', ru: 'Устарело' },
  ACTIVE: { en: 'Active', ar: 'نشط', ru: 'Активно' },
  'Higher Highs Sequence': { en: 'Higher Highs Sequence', ar: 'سلسلة قمم متصاعدة', ru: 'Восходящая структура максимумов' },
  'Lower Lows Sequence': { en: 'Lower Lows Sequence', ar: 'سلسلة قيعان هابطة', ru: 'Нисходящая структура минимумов' },
  Consolidation: { en: 'Consolidation', ar: 'تذبذب وتماسك عرضي', ru: 'Консолидация' },
  TRENDING: { en: 'Trending', ar: 'اتجاهي قوي', ru: 'Трендовый' },
  RANGING: { en: 'Ranging', ar: 'نطاق عرضي', ru: 'Боковой диапазон' },
  NORMAL: { en: 'Normal', ar: 'طبيعي', ru: 'Нормальный' },
  HIGH: { en: 'High', ar: 'مرتفع', ru: 'Высокий' },
  LOW: { en: 'Low', ar: 'منخفض', ru: 'Низкий' },
  'Awaiting Pivot': { en: 'Awaiting Pivot', ar: 'في انتظار نقطة الارتكاز', ru: 'Ожидание разворота' },
  'DATA_NOT_READY': { en: 'Data Not Ready', ar: 'البيانات قيد الاكتمال', ru: 'Данные не готовы' },
  'Calculating...': { en: 'Calculating...', ar: 'جارٍ الحساب...', ru: 'Расчет...' },
  'Support (S1)': { en: 'Support (S1)', ar: 'مستوى الدعم (S1)', ru: 'Поддержка (S1)' },
  'Resistance (R1)': { en: 'Resistance (R1)', ar: 'مستوى المقاومة (R1)', ru: 'Сопротивление (R1)' },
  'Last Candle (OHLC)': { en: 'Last Candle (OHLC)', ar: 'آخر شمعة (OHLC)', ru: 'Последняя свеча (OHLC)' },
  'Waiting for candle feed...': { en: 'Waiting for candle feed...', ar: 'في انتظار تدفق الشموع...', ru: 'Ожидание потока свечей...' },
  Freshness: { en: 'Freshness', ar: 'زمن التحديث', ru: 'Актуальность' },
  'Pocket Option OTC Feed': { en: 'Pocket Option OTC Feed', ar: 'بث أسواق OTC الموازية', ru: 'Поток Pocket Option OTC' },
  'Pocket Option Real Feed': { en: 'Pocket Option Real Feed', ar: 'بث الأسواق الحقيقية', ru: 'Реальный поток Pocket Option' },
  'SUPPORTIVE': { en: 'SUPPORTIVE', ar: 'داعم', ru: 'ПОДДЕРЖИВАЕТ' },
  'OPPOSING': { en: 'OPPOSING', ar: 'معارض', ru: 'ПРОТИВ' },
  'NEUTRAL_TERM': { en: 'NEUTRAL', ar: 'محايد', ru: 'НЕЙТРАЛЬНО' },
  Price: { en: 'Price', ar: 'السعر', ru: 'Цена' },
};

/**
 * Translates a single technical term from the map.
 */
export function translateTerm(term: string, lang: Language): string {
  if (!term) return '';
  const trimmed = term.trim();
  const directMatch = TECHNICAL_TERMINOLOGY[trimmed];
  if (directMatch && directMatch[lang]) {
    return directMatch[lang];
  }
  // Try case-insensitive lookup
  const lower = trimmed.toLowerCase();
  for (const key of Object.keys(TECHNICAL_TERMINOLOGY)) {
    if (key.toLowerCase() === lower) {
      return TECHNICAL_TERMINOLOGY[key][lang];
    }
  }
  return term;
}

/**
 * Dynamic message translator: translates system messages, status notices,
 * and strategy explanations according to the user's selected language.
 */
export function translateDynamicMessage(text: string, lang: Language): string {
  if (!text || typeof text !== 'string') return '';
  if (lang === 'en') return text;

  // Exact / prefix matches for common engine messages
  const translationsAR: Record<string, string> = {
    'WHY THIS SIGNAL?': 'لماذا ظهرت هذه الإشارة؟',
    'Transparent Signal Reasoning Engine': 'محرك تفسير وتبرير الإشارات الرياضية الشفاف',
    'Algorithmic Thesis & Market Driver:': 'الأطروحة الخوارزمية ومحرك السوق الأساسي:',
    'Quantitative Indicator Evidence': 'الأدلة الرقمية من المؤشرات الفنية',
    'Supporting Strategies': 'الاستراتيجيات الداعمة',
    'Opposing Strategies': 'العوامل والاستراتيجيات المعارضة',
    'Wait Reasons & Safety Locks': 'أسباب الانتظار وأقفال الحماية الدفاعية',
    'Requirements to Unlock Signal': 'شروط فك القفل وتوليد إشارة تداول:',
    'Audited Non-Repainting': 'معتمد ومحمي من إعادة الرسم: يعتمد حصرًا على الشموع المغلقة المؤكدة',
    'LIVE STREAM': 'بث مباشر',
    'AUTHENTICATED': 'تمت المصادقة بنجاح',
    'AUTH FAILED (UPDATE SSD)': 'فشلت المصادقة (يرجى تحديث رمز SSD)',
    'SOCKET CONNECTED': 'المقبس متصل (في انتظار المصادقة)',
    'RECONNECTING': 'جارٍ إعادة المزامنة',
    'SYNCING': 'جارٍ المزامنة السحابية',
    'DISCONNECTED': 'غير متصل',
    'No valid setup': 'لا يوجد نموذج فني مكتمل',
    'Insufficient candles': 'عدد الشموع غير كافٍ',
    'Data stale': 'بيانات السوق غير محدثة',
    'Strategy conflict': 'تعارض في إشارات الاستراتيجيات',
    'Indicator not ready': 'المؤشرات قيد الحساب والتسخين',
    'Market unavailable': 'بيانات السوق غير متاحة حالياً',
    'Authentication unavailable': 'جلسة التداول غير مصادق عليها',
    'WAITING FOR REAL CALCULATION': 'في انتظار الحسابات الرقمية الحقيقية',
    'WAITING FOR EVIDENCE': 'في انتظار اكتمال الأدلة الفنية',
    'Awaiting Pocket Option account connection.': 'في انتظار اكتمال الاتصال بحساب Pocket Option.',
    'Deterministic signal generation requires an authenticated real-time feed': 'يتطلب توليد الإشارات الحتمية بثاً مباشراً مصادقاً عليه في الوقت الحقيقي',
    'Upstream dependency failure: Session not verified or WebSocket inactive': 'فشل التبعيات الأساسية: الجلسة غير مصادقة أو المقبس غير نشط',
    'All required indicators validated and active': 'تم التحقق من جميع المؤشرات الفنية المطلوبة وهي نشطة',
    'Waiting for real market ticks and minimum 15 closed candles...': 'في انتظار وصول تدفق الأسعار والحد الأدنى (15 شمعة مغلقة)...',
    'Analysis Engine Standby': 'محرك التحليل في وضع الاستعداد',
    'Quantitative analysis pipeline is currently paused. Press "START ANALYSIS" to initiate real-time indicator evaluation and multi-strategy confluence.': 'نظام التحليل الكمي متوقف مؤقتاً. اضغط على "بدء التحليل" لتفعيل احتساب المؤشرات وتوافق الاستراتيجيات الفوري.',
    'BULLISH MARKET BIAS': 'انحياز صاعد (شراء)',
    'BEARISH MARKET BIAS': 'انحياز هابط (بيع)',
    'NEUTRAL / RANGING': 'محايد / نطاق عرضي',
    'WAIT FOR EVIDENCE': 'انتظار اكتمال الأدلة',
    'Authoritative Market Direction': 'الاتجاه المؤسسي المعتمد',
    'Trend': 'الاتجاه',
    'Momentum': 'الزخم',
    'Structure': 'هيكل السوق',
    'Volatility': 'التقلب',
    'Real Algorithmic Indicators': 'المؤشرات الخوارزمية الحقيقية',
    'bars analyzed': 'شمعة تم تحليلها',
    'RSI (14 Wilder)': 'مؤشر القوة النسبية (RSI 14 Wilder)',
    'Oversold (≤30)': 'ذروة البيع (≤30)',
    'Overbought (≥70)': 'ذروة الشراء (≥70)',
    'ADX Trend Strength': 'قوة الاتجاه (مؤشر ADX)',
    'EMA Trend (9 / 21)': 'اتجاه شريط المتوسطات (9 / 21)',
    'Fast EMA 9': 'المتوسط السريع EMA 9',
    'Slow EMA 21': 'المتوسط البطيء EMA 21',
    'MACD & ATR Volatility': 'مؤشر MACD والتقلب (ATR)',
    'Bollinger Bands (20, 2)': 'نطاقات بولينجر (20, 2)',
    'Lower': 'الحد السفلي',
    'Middle': 'الخط الأوسط',
    'Upper': 'الحد العلوي',
    'Histogram': 'المدرج التكراري',
    'Signal': 'خط الإشارة',
    'Status: Collecting Data': 'الحالة: جارٍ تجميع البيانات',
    'W.D. GANN PRICE/TIME ANALYSIS': 'تحليل السعر والزمن لدبليو دي جان',
    '50% EQUILIBRIUM': 'توازن 50% (Equilibrium)',
    '1x1 BALANCE ANGLE': 'زاوية التوازن 1×1',
    'ELAPSED TIME BARS': 'الشموع المنقضية',
    'PRICE/TIME SQUARED': 'تربيع السعر والزمن',
    'RALPH NELSON ELLIOTT WAVE ANALYSIS': 'تحليل موجات إليوت لرالف نيلسون',
    'Rule Match': 'مطابقة القواعد',
    'PRIMARY:': 'العد الأساسي:',
    'ALTERNATIVE:': 'العد البديل:',
    'Verified Structural Impulse Rules:': 'قواعد الموجات الدافعة المدققة:',
    'NICOLAS DARVAS BOX STRATEGY': 'استراتيجية صناديق نيكولاس دارفاس',
    'BOX CONFIRMED': 'صندوق مؤكد',
    'BOX FORMING': 'صندوق قيد التكوين',
    'UPPER BOUNDARY': 'الحد العلوي',
    'LOWER BOUNDARY': 'الحد السفلي',
    'CANDLES IN BOX': 'الشموع داخل الصندوق',
    'BREAKOUT STATUS': 'حالة الاختراق',
    'Reference Price': 'السعر المرجعي',
    'Strategy Score': 'نقاط الاستراتيجية',
    'Expiry Recommendation': 'مدة الانتهاء الموصى بها',
    'Audited Technical Indicator Snapshot': 'لقطة المؤشرات الفنية المدققة',
    'Full Strategy Voting Breakdown': 'التصويت الكامل لوحدات الاستراتيجيات',
    'Weight': 'الوزن',
    'Score': 'النقاط',
    'Zero significant opposing signals detected. High directional clarity.': 'لم يتم رصد أي إشارات معارضة ذات مغزى. وضوح اتجاهي عالٍ.',
    'No directional consensus reached yet.': 'لم يتم التوصل إلى إجماع اتجاهي بعد.',
    'Audited Non-Repainting: Calculated exclusively from confirmed closed candles.': 'معتمد ومحمي من إعادة الرسم: يعتمد حصرًا على الشموع المغلقة المؤكدة.',
    'Real Broker Data Pipeline Active — Zero Synthetic Data Permitted': 'مسار بيانات الوسيط الحقيقي نشط — حظر تام لأي بيانات مصطنعة',
    'WAITING FOR POCKET OPTION CANDLE STREAM': 'في انتظار تدفق شموع Pocket Option',
    'CHART PIPELINE & PERSISTENCE DIAGNOSTICS': 'تشخيص مسار الرسم البياني واستمرارية البيانات',
    'Chart Canvas Engine': 'محرك الرسم البياني',
    'Candle Stream Pipeline': 'مسار تدفق الشموع',
    'RAW VERIFIED CANDLES': 'الشموع الحقيقية المدققة',
    'Awaiting market candle stream...': 'في انتظار تدفق شموع السوق...',
    'LATEST:': 'الأحدث:',
    'Awaiting Pivot': 'في انتظار نقطة الارتكاز',
    'Waiting for candle feed...': 'في انتظار تدفق الشموع...',
    'Accumulating Swings': 'تجميع القمم والقيعان',
    'DATA_NOT_READY': 'البيانات قيد الاكتمال',
    'Calculating...': 'جارٍ الحساب...',
  };

  const translationsRU: Record<string, string> = {
    'WHY THIS SIGNAL?': 'ПОЧЕМУ ПОЯВИЛСЯ ЭТОТ СИГНАЛ?',
    'Transparent Signal Reasoning Engine': 'Прозрачный математический движок обоснования сигналов',
    'Algorithmic Thesis & Market Driver:': 'Алгоритмический тезис и рыночный драйвер:',
    'Quantitative Indicator Evidence': 'Количественные данные технических индикаторов',
    'Supporting Strategies': 'Подтверждающие стратегии',
    'Opposing Strategies': 'Противоположные факторы и стратегии',
    'Wait Reasons & Safety Locks': 'Причины ожидания и защитные блокировки',
    'Requirements to Unlock Signal': 'Условия для формирования сигнала:',
    'Audited Non-Repainting': 'Защита от перерисовки: расчет строго по подтвержденным закрытым свечам',
    'LIVE STREAM': 'ПРЯМОЙ ЭФИР',
    'AUTHENTICATED': 'АУТЕНТИФИЦИРОВАН',
    'AUTH FAILED (UPDATE SSD)': 'СБОЙ АВТОРИЗАЦИИ (ОБНОВИТЕ SSD)',
    'SOCKET CONNECTED': 'СОКЕТ ПОДКЛЮЧЕН (ОЖИДАНИЕ АВТОРИЗАЦИИ)',
    'RECONNECTING': 'ПЕРЕПОДКЛЮЧЕНИЕ',
    'SYNCING': 'СИНХРОНИЗАЦИЯ',
    'DISCONNECTED': 'ОТКЛЮЧЕНО',
    'No valid setup': 'Нет валидной формации',
    'Insufficient candles': 'Недостаточно свечей',
    'Data stale': 'Данные устарели',
    'Strategy conflict': 'Конфликт сигналов стратегий',
    'Indicator not ready': 'Индикаторы не готовы (идет расчет)',
    'Market unavailable': 'Рыночные данные недоступны',
    'Authentication unavailable': 'Сессия не авторизована',
    'WAITING FOR REAL CALCULATION': 'ОЖИДАНИЕ РЕАЛЬНЫХ РАСЧЕТОВ',
    'WAITING FOR EVIDENCE': 'ОЖИДАНИЕ ТЕХНИЧЕСКИХ ДАННЫХ',
    'Awaiting Pocket Option account connection.': 'Ожидание подключения к аккаунту Pocket Option.',
    'Deterministic signal generation requires an authenticated real-time feed': 'Генерация сигналов требует авторизованного потока данных реального времени',
    'Upstream dependency failure: Session not verified or WebSocket inactive': 'Сбой источника: сессия не подтверждена или сокет не активен',
    'All required indicators validated and active': 'Все индикаторы успешно рассчитаны и активны',
    'Waiting for real market ticks and minimum 15 closed candles...': 'Ожидание тиков и минимум 15 закрытых свечей...',
    'Analysis Engine Standby': 'Движок анализа в режиме ожидания',
    'Quantitative analysis pipeline is currently paused. Press "START ANALYSIS" to initiate real-time indicator evaluation and multi-strategy confluence.': 'Конвейер количественного анализа на паузе. Нажмите «НАЧАТЬ АНАЛИЗ» для запуска расчета индикаторов и стратегий.',
    'BULLISH MARKET BIAS': 'БЫЧИЙ НАСТРОЙ (ПОКУПКА)',
    'BEARISH MARKET BIAS': 'МЕДВЕЖИЙ НАСТРОЙ (ПРОДАЖА)',
    'NEUTRAL / RANGING': 'НЕЙТРАЛЬНЫЙ / БОКОВИК',
    'WAIT FOR EVIDENCE': 'ОЖИДАНИЕ СИГНАЛОВ',
    'Authoritative Market Direction': 'Институциональное направление рынка',
    'Trend': 'Тренд',
    'Momentum': 'Импульс',
    'Structure': 'Структура',
    'Volatility': 'Волатильность',
    'Real Algorithmic Indicators': 'Реальные алгоритмические индикаторы',
    'bars analyzed': 'свечей проанализировано',
    'RSI (14 Wilder)': 'RSI (14 Уайлдера)',
    'Oversold (≤30)': 'Перепроданность (≤30)',
    'Overbought (≥70)': 'Перекупленность (≥70)',
    'ADX Trend Strength': 'Сила тренда ADX',
    'EMA Trend (9 / 21)': 'Трендовая лента EMA (9 / 21)',
    'Fast EMA 9': 'Быстрая EMA 9',
    'Slow EMA 21': 'Медленная EMA 21',
    'MACD & ATR Volatility': 'MACD и волатильность (ATR)',
    'Bollinger Bands (20, 2)': 'Полосы Боллинджера (20, 2)',
    'Lower': 'Нижняя',
    'Middle': 'Средняя',
    'Upper': 'Верхняя',
    'Histogram': 'Гистограмма',
    'Signal': 'Сигнал',
    'Status: Collecting Data': 'Статус: сбор данных',
    'W.D. GANN PRICE/TIME ANALYSIS': 'Анализ цены и времени В.Д. Ганна',
    '50% EQUILIBRIUM': '50% Равновесие (Equilibrium)',
    '1x1 BALANCE ANGLE': 'Угол баланса 1x1',
    'ELAPSED TIME BARS': 'Прошедшие бары',
    'PRICE/TIME SQUARED': 'Квадратура цены и времени',
    'RALPH NELSON ELLIOTT WAVE ANALYSIS': 'Анализ волн Эллиотта',
    'Rule Match': 'Соответствие правилам',
    'PRIMARY:': 'ОСНОВНОЙ:',
    'ALTERNATIVE:': 'АЛЬТЕРНАТИВНЫЙ:',
    'Verified Structural Impulse Rules:': 'Проверенные правила импульсной волны:',
    'NICOLAS DARVAS BOX STRATEGY': 'Стратегия коробок Николаса Дарваса',
    'BOX CONFIRMED': 'КОРОБКА ПОДТВЕРЖДЕНА',
    'BOX FORMING': 'КОРОБКА ФОРМИРУЕТСЯ',
    'UPPER BOUNDARY': 'ВЕРХНЯЯ ГРАНИЦА',
    'LOWER BOUNDARY': 'НИЖНЯЯ ГРАНИЦА',
    'CANDLES IN BOX': 'Свечей в коробке',
    'BREAKOUT STATUS': 'Статус пробоя',
    'Reference Price': 'Опорная цена',
    'Strategy Score': 'Оценка стратегии',
    'Expiry Recommendation': 'Рекомендация экспирации',
    'Audited Technical Indicator Snapshot': 'Аудит снимка технических индикаторов',
    'Full Strategy Voting Breakdown': 'Полная разбивка голосования стратегий',
    'Weight': 'Вес',
    'Score': 'Оценка',
    'Zero significant opposing signals detected. High directional clarity.': 'Противоречивых сигналов не обнаружено. Высокая направленная четкость.',
    'No directional consensus reached yet.': 'Направленный консенсус еще не достигнут.',
    'Audited Non-Repainting: Calculated exclusively from confirmed closed candles.': 'Аудит без перерисовки: расчет строго по закрытым свечам.',
    'Real Broker Data Pipeline Active — Zero Synthetic Data Permitted': 'Активен реальный поток брокера — синтетические данные запрещены',
    'WAITING FOR POCKET OPTION CANDLE STREAM': 'ОЖИДАНИЕ ПОТОКА СВЕЧЕЙ POCKET OPTION',
    'CHART PIPELINE & PERSISTENCE DIAGNOSTICS': 'Диагностика графика и потока данных',
    'Chart Canvas Engine': 'Движок отрисовки графика',
    'Candle Stream Pipeline': 'Поток свечей',
    'RAW VERIFIED CANDLES': 'РЕАЛЬНЫЕ ПРОВЕРЕННЫЕ СВЕЧИ',
    'Awaiting market candle stream...': 'Ожидание потока рыночных свечей...',
    'LATEST:': 'ПОСЛЕДНЯЯ:',
    'Awaiting Pivot': 'Ожидание разворота',
    'Waiting for candle feed...': 'Ожидание свечей...',
    'Accumulating Swings': 'Накопление колебаний',
    'DATA_NOT_READY': 'ДАННЫЕ НЕ ГОТОВЫ',
    'Calculating...': 'Расчет...',
  };

  const dict = lang === 'ar' ? translationsAR : translationsRU;
  if (dict[text]) {
    return dict[text];
  }

  // Handle dynamic pattern replacements
  if (text.includes('NotAuthorized')) {
    return lang === 'ar'
      ? 'تم رفض مصادقة الجلسة من قبل خادم Pocket Option (NotAuthorized). رمز الجلسة / SSD غير صالح أو منتهي الصلاحية.'
      : 'Сессия отклонена сервером Pocket Option (NotAuthorized). Токен SSD недействителен или истек.';
  }

  if (text.includes('INSTITUTIONAL BULLISH EXPANSION')) {
    const match = text.match(/\((\d+)% CONFIDENCE\)/);
    const conf = match ? match[1] : '';
    return lang === 'ar'
      ? `توسع صاعد مؤسسي (بنسبة ثقة ${conf}%)`
      : `Институциональный бычий импульс (уверенность ${conf}%)`;
  }

  if (text.includes('INSTITUTIONAL BEARISH CONTRACTION')) {
    const match = text.match(/\((\d+)% CONFIDENCE\)/);
    const conf = match ? match[1] : '';
    return lang === 'ar'
      ? `انكماش هابط مؤسسي (بنسبة ثقة ${conf}%)`
      : `Институциональный медвежий спад (уверенность ${conf}%)`;
  }

  if (text.startsWith('FILTER ACTIVE:')) {
    const reason = text.replace('FILTER ACTIVE:', '').trim();
    return lang === 'ar' ? `الفلتر الدفاعي نشط: ${reason}` : `Защитный фильтр активен: ${reason}`;
  }

  if (text.includes('Fast dynamic trend is bullish')) {
    return lang === 'ar'
      ? 'الاتجاه الديناميكي السريع صاعد، والسعر يتحرك فوق المتوسط المتحرك المؤسسي'
      : 'Быстрый динамический тренд восходящий, цена выше институционального среднего';
  }

  if (text.includes('Fast dynamic trend is bearish')) {
    return lang === 'ar'
      ? 'الاتجاه الديناميكي السريع هابط، والسعر يتحرك تحت المتوسط المتحرك المؤسسي'
      : 'Быстрый динамический тренд нисходящий, цена ниже институционального среднего';
  }

  if (text.includes('Overbought zone')) {
    return lang === 'ar'
      ? 'مؤشر RSI في منطقة ذروة الشراء (احتمال تشبع أو استمرار الزخم القوي)'
      : 'Индикатор RSI в зоне перекупленности (вероятность истощения или сильного импульса)';
  }

  if (text.includes('Oversold zone')) {
    return lang === 'ar'
      ? 'مؤشر RSI في منطقة ذروة البيع (احتمال ارتداد تصحيحي صاعد)'
      : 'Индикатор RSI в зоне перепроданности (вероятность отскока)';
  }

  if (text.includes('positive bullish momentum above midline')) {
    return lang === 'ar'
      ? 'مؤشر RSI يظهر زخماً صاعداً إيجابياً فوق خط المنتصف (50)'
      : 'Индикатор RSI демонстрирует положительный бычий импульс выше уровня 50';
  }

  if (text.includes('negative bearish drift below midline')) {
    return lang === 'ar'
      ? 'مؤشر RSI يظهر انزلاقاً هابطاً تحت خط المنتصف (50)'
      : 'Индикатор RSI демонстрирует медвежье смещение ниже уровня 50';
  }

  return text;
}
