# Medo Filter

أداة ويب لاستخراج وتنظيف أرقام الهاتف من الملفات، مع دعم خاص لملفات Excel وCSV.

## المميزات
- دعم: `xlsx`, `csv`, `txt`, `log`, `json`, `html`, `xml`
- أولوية صارمة لعمود `Number` عند وجوده
- عدم دمج `Country` أو `Range` مع الأرقام
- إزالة التكرار مع الحفاظ على ترتيب أول ظهور
- تحويل الأرقام العربية والفارسية إلى إنجليزية
- تنزيل ملف TXT واحد لكل الأرقام
- تنزيل ZIP منفصل للـ ranges
- أسماء التحميل تتزايد تلقائيًا داخل المتصفح

## التشغيل
```bash
npm install
npm run dev
```

## الاختبارات
```bash
npm test
```

## رفع المشروع إلى GitHub دفعة واحدة
### من المتصفح
1. افتح GitHub.
2. أنشئ Repository جديد.
3. اضغط **Add file** ثم **Upload files**.
4. اسحب ملف `medo-filter.zip` نفسه أو فكّه واسحب **كل الملفات مرة واحدة**.
5. اضغط **Commit changes**.

### من Git محليًا
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

## النشر على Vercel
1. اربط المستودع مع Vercel.
2. اختر المشروع.
3. اضغط Deploy.

Vercel يضبط إعدادات Next.js تلقائيًا. Next.js 16.2.6 هو الإصدار الظاهر في الوثائق حاليًا، وVercel يدعم نشر مشاريع Next.js مباشرة، كما يدعم الربط مع Git أو النشر عبر CLI. citeturn782015search2turn782015search1turn782015search3turn782015search5
