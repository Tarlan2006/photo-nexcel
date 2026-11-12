export const translations = {
  ru: {
    lang: 'RU',
    langFull: 'Русский',
    altLang: 'KZ',
    altLangFull: 'Қазақша',

    // Header
    headerBack: 'nexcel.kz',

    // Wizard Steps
    stepLabel1: 'Фото',
    stepLabel2: 'Документ',
    stepLabel3: 'Проверка',
    stepLabel4: 'Готово',

    // Wizard Navigation
    btnBack: 'Назад',
    btnNext: 'Далее',
    btnRetake: 'Переснять',

    // Step 1
    step1Title: 'Фото на удостоверение РК и Green Card',
    step1Subtitle: 'Сделайте селфи или выберите фото. Подгоним размер и кадр под требования',
    btnShootOrUpload: 'Снять или выбрать фото',
    tipsToggle: 'Как сделать правильное фото',

    // Step 2
    step2Title: 'Выберите документ',
    step2Subtitle: 'Проверьте мини-превью: фото уже кадрировано под требования',
    outOfBoundsCard: 'Нужно больше места вокруг головы',

    // Step 3
    step3Title: 'Проверка и подстройка',
    step3Subtitle: 'Убедитесь, что лицо в кадре, или отрегулируйте ползунками',

    // Step 4
    step4Title: 'Фото готово к скачиванию',
    step4Subtitle: 'Файл кадрирован и оптимизирован под требования документа',
    btnDownloadJpeg: 'Скачать JPEG',
    btnOtherDoc: 'Другой документ',
    btnNewPhoto: 'Новое фото',

    // Compact Privacy
    compactPrivacyText: 'Фото обрабатывается на вашем устройстве и никуда не отправляется',

    // How to shoot tips
    howToShootLabel: '[ КАК СНЯТЬ ]',
    howToShootTitle: 'Как сделать правильное фото',
    howToShootTips: [
      {
        title: 'Светлая стена',
        desc: 'Встаньте на фоне светлой однотонной стены без узоров и картин.',
        icon: 'wall',
      },
      {
        title: 'Ровный свет спереди',
        desc: 'Лицо должно быть равномерно освещено, без теней под глазами и носом.',
        icon: 'sun',
      },
      {
        title: 'Камера на уровне глаз',
        desc: 'Держите телефон ровно перед собой, не наклоняя вверх или вниз.',
        icon: 'camera',
      },
      {
        title: 'Дистанция 1–1,5 м',
        desc: 'Отойдите на 1–1,5 м от камеры или попросите кого-то сфотографировать вас.',
        icon: 'distance',
      },
      {
        title: 'Запас для Green Card',
        desc: 'Для Green Card вокруг головы нужно больше свободного места.',
        icon: 'greencard',
      },
    ],

    // Upload
    uploadLabel: '[ ЗАГРУЗКА ]',
    uploadTitle: 'Загрузите ваше фото',
    uploadSubtitle: 'Перетащите файл или нажмите для выбора. Поддерживаются JPG, PNG или фото с телефона.',
    uploadDrag: 'Перетащите фото сюда',
    uploadOr: 'или',
    uploadBtn: 'Выбрать файл',
    uploadHint: 'JPG, PNG или фото с телефона',

    // Processing & Errors
    processingModel: 'Загрузка модели ИИ...',
    processingFace: 'Поиск лица и кадрирование...',
    downloading: 'Подготовка и сжатие файла...',
    errNoFace: 'Лицо не обнаружено. Пожалуйста, загрузите чёткое фото лица анфас.',
    errMultipleFaces: 'Обнаружено несколько лиц. На фото должен быть только один человек.',
    errOutOfBounds: 'Отойдите дальше, вокруг головы нужно больше места.',
    errOutOfBoundsHint: 'Кадр выходит за границы фото. Уменьшите масштаб ползунком ниже.',
    errRead: 'Не удалось прочитать изображение. Попробуйте другой файл.',
    errUnsupportedFormat: 'Этот формат не поддерживается. Сохраните фото как JPG или PNG.',
    errFileTooLarge: 'Файл превышает лимит {max} КБ даже при сжатии. Попробуйте фото с меньшим количеством шумов.',

    // Result & Adjustments
    resultLabel: '[ РЕЗУЛЬТАТ ]',
    resultTitle: 'Ваше фото готово',
    resultSubtitle: 'Скачайте в нужном формате — для печати или электронной подачи.',
    resultDownload: 'Скачать фото',
    resultRetry: 'Загрузить другое',
    resultSize: 'Размер',
    adjustTitle: 'Ручная подстройка',
    adjustScale: 'Масштаб',
    adjustShiftY: 'По вертикали',
    adjustReset: 'Сброс',
    exportLimitInfo: '{w} × {h} px · {kb} КБ (лимит: до {max} КБ)',

    // Checks
    checksTitle: 'Проверка параметров',
    checkStatusOk: 'Ок',
    checkStatusWarn: 'Внимание',
    checkStatusManual: 'Проверьте',
    checkTiltOk: 'Наклон головы: ровно',
    checkTiltWarn: 'Наклон головы {deg}° (выровнен автоматически)',
    checkYawOk: 'Взгляд строго анфас',
    checkYawWarn: 'Голова слегка повернута в сторону',
    checkBrightnessOk: 'Освещение лица равномерное',
    checkBrightnessDark: 'Лицо темновато, добавьте свет',
    checkBrightnessBright: 'Лицо пересвечено, уменьшите свет',
    checkSharpnessOk: 'Резкость и четкость в норме',
    checkSharpnessWarn: 'Возможно, фото размыто или не в фокусе',
    checkHeadOk: 'Размер головы: {pct}% кадра (норма {min}–{max}%)',
    checkHeadWarn: 'Размер головы: {pct}% кадра (вне нормы {min}–{max}%)',

    // Manual checks
    manualGlasses: 'Без бликов на очках',
    manualMouth: 'Рот закрыт, выражение нейтральное',
    manualShadows: 'Нет теней на лице и фоне',
    manualBg: 'Светлый однотонный фон',

    // FAQ
    faqLabel: '[ ЧАСТЫЕ ВОПРОСЫ ]',
    faqTitle: 'Ответы на вопросы',
    faqs: [
      {
        q: 'Фото примут в ЦОНе?',
        a: 'Подгоним размер и кадр под требования. Окончательное решение о приёмке принимает eGov или госдеп США.',
      },
      {
        q: 'Сколько это стоит?',
        a: 'Сервис полностью бесплатный.',
      },
      {
        q: 'Какие фото подходят для загрузки?',
        a: 'Любое чёткое фото лица анфас. Подойдёт даже селфи на телефон.',
      },
      {
        q: 'Мои фото хранятся у вас?',
        a: 'Нет. Фото обрабатывается на вашем устройстве и никуда не отправляется.',
      },
    ],

    // Footer
    footerProduct: '© 2026 Nexcel. Все права защищены.',
    footerPrivacy: 'Приватность и безопасность',
    footerContact: 'Связаться с нами',
  },

  kz: {
    lang: 'KZ',
    langFull: 'Қазақша',
    altLang: 'RU',
    altLangFull: 'Русский',

    headerBack: 'nexcel.kz',

    // Wizard Steps
    stepLabel1: 'Фото',
    stepLabel2: 'Құжат',
    stepLabel3: 'Тексеру',
    stepLabel4: 'Дайын',

    // Wizard Navigation
    btnBack: 'Артқа',
    btnNext: 'Алға',
    btnRetake: 'Қайта түсіру',

    // Step 1
    step1Title: 'ҚР жеке куәлігі және Green Card фотосы',
    step1Subtitle: 'Селфи түсіріңіз немесе фото таңдаңыз. Өлшем мен кадрды талаптарға сай реттейміз',
    btnShootOrUpload: 'Фото түсіру немесе таңдау',
    tipsToggle: 'Дұрыс фотоны қалай түсіру керек',

    // Step 2
    step2Title: 'Құжатты таңдаңыз',
    step2Subtitle: 'Алдын ала қарау: фото талаптарға сай кадрланған',
    outOfBoundsCard: 'Бас айналасында көбірек орын қажет',

    // Step 3
    step3Title: 'Тексеру және баптау',
    step3Subtitle: 'Беттің дұрыс орналасқанына көз жеткізіңіз немесе сырғытпалармен реттеңіз',

    // Step 4
    step4Title: 'Фото жүктеп алуға дайын',
    step4Subtitle: 'Файл кадрланды және құжат талаптарына сай оңтайландырылды',
    btnDownloadJpeg: 'JPEG жүктеп алу',
    btnOtherDoc: 'Басқа құжат',
    btnNewPhoto: 'Жаңа фото',

    // Compact Privacy
    compactPrivacyText: 'Фото сіздің құрылғыңызда өңделеді және ешқайда жіберілмейді',

    // How to shoot tips
    howToShootLabel: '[ ҚАЛАЙ ТҮСІРУ КЕРЕК ]',
    howToShootTitle: 'Дұрыс фотоны қалай түсіру керек',
    howToShootTips: [
      {
        title: 'Ашық қабырға',
        desc: 'Суретсіз және ою-өрнексіз ашық түсті біркелкі қабырға алдында тұрыңыз.',
        icon: 'wall',
      },
      {
        title: 'Алдыңғы біркелкі жарық',
        desc: 'Бетке жарық біркелкі түсуі тиіс, көз бен мұрын астында көлеңке болмасын.',
        icon: 'sun',
      },
      {
        title: 'Камера көз деңгейінде',
        desc: 'Телефонды дәл алдыңызда ұстаңыз, жоғары не төмен еңкейтпеңіз.',
        icon: 'camera',
      },
      {
        title: '1–1,5 м қашықтық',
        desc: 'Камерадан 1–1,5 м алыс тұрыңыз немесе біреуден түсіруді сұраңыз.',
        icon: 'distance',
      },
      {
        title: 'Green Card үшін кең орын',
        desc: 'Green Card үшін бас айналасында көбірек бос орын қажет.',
        icon: 'greencard',
      },
    ],

    uploadLabel: '[ ЖҮКТЕУ ]',
    uploadTitle: 'Фотоңызды жүктеңіз',
    uploadSubtitle: 'Файлды сүйреп әкеліңіз немесе таңдау үшін басыңыз. JPG, PNG немесе телефоннан фото.',
    uploadDrag: 'Фотоны осында сүйреңіз',
    uploadOr: 'немесе',
    uploadBtn: 'Файл таңдау',
    uploadHint: 'JPG, PNG немесе телефоннан фото',

    // Processing & Errors
    processingModel: 'ЖИ моделі жүктелуде...',
    processingFace: 'Бетті анықтау және кадрлау...',
    downloading: 'Файлды дайындау және сығу...',
    errNoFace: 'Бет анықталмады. Бетті анық көрсететін фото жүктеңіз.',
    errMultipleFaces: 'Бірнеше адам табылды. Фотода тек бір адам болуы керек.',
    errOutOfBounds: 'Алысырақ тұрыңыз, бас айналасында көбірек орын қажет.',
    errOutOfBoundsHint: 'Кадр фото шекарасынан шығып тұр. Төмендегі сырғытпамен масштабты азайтыңыз.',
    errRead: 'Суретті оқу мүмкін болмады. Басқа файлды байқап көріңіз.',
    errUnsupportedFormat: 'Бұл форматқа қолдау көрсетілмейді. Фотоны JPG немесе PNG ретінде сақтаңыз.',
    errFileTooLarge: 'Файл сығудан кейін де {max} КБ лимитінен асып тұр. Фон біркелкі фотоны байқап көріңіз.',

    // Result & Adjustments
    resultLabel: '[ НӘТИЖЕ ]',
    resultTitle: 'Фотоңыз дайын',
    resultSubtitle: 'Қажетті форматта жүктеп алыңыз — басып шығару немесе электронды тапсыру үшін.',
    resultDownload: 'Фотоны жүктеу',
    resultRetry: 'Басқа фото жүктеу',
    resultSize: 'Өлшемі',
    adjustTitle: 'Қолмен баптау',
    adjustScale: 'Масштаб',
    adjustShiftY: 'Тігінен',
    adjustReset: 'Қайтару',
    exportLimitInfo: '{w} × {h} px · {kb} КБ (шектеу: {max} КБ дейін)',

    // Checks
    checksTitle: 'Параметрлерді тексеру',
    checkStatusOk: 'Дұрыс',
    checkStatusWarn: 'Назар аударыңыз',
    checkStatusManual: 'Тексеріңіз',
    checkTiltOk: 'Бастың еңкеюі: дұрыс',
    checkTiltWarn: 'Бастың еңкеюі {deg}° (автоматты түзелді)',
    checkYawOk: 'Тіке алдынан қараған',
    checkYawWarn: 'Бас сәл бір жаққа бұрылған',
    checkBrightnessOk: 'Беттің жарығы біркелкі',
    checkBrightnessDark: 'Бет қараңғылау, жарық қосыңыз',
    checkBrightnessBright: 'Бет тым жарық, жарықты азайтыңыз',
    checkSharpnessOk: 'Анықтылығы жақсы',
    checkSharpnessWarn: 'Фото бұлыңғыр болуы мүмкін',
    checkHeadOk: 'Бас өлшемі: кадрдың {pct}% (норма {min}–{max}%)',
    checkHeadWarn: 'Бас өлшемі: кадрдың {pct}% (нормадан тыс {min}–{max}%)',

    // Manual checks
    manualGlasses: 'Көзәйнекте шағылысу жоқ',
    manualMouth: 'Ауыз жабық, бейтарап көрініс',
    manualShadows: 'Бетте және фонда көлеңке жоқ',
    manualBg: 'Ашық түсті біркелкі фон',

    faqLabel: '[ ЖИІ ҚОЙЫЛАТЫН СҰРАҚТАР ]',
    faqTitle: 'Сұрақтарға жауаптар',
    faqs: [
      {
        q: 'Фотоны ХҚО-да қабылдай ма?',
        a: 'Өлшем мен кадрды талаптарға сай реттейміз. Түпкілікті шешімді eGov немесе АҚШ мемдепі қабылдайды.',
      },
      {
        q: 'Бұл қанша тұрады?',
        a: 'Сервис толығымен тегін.',
      },
      {
        q: 'Қандай фото жүктеуге болады?',
        a: 'Бетті анық көрсететін кез келген фото. Тіпті телефонмен түсірілген селфи де жарайды.',
      },
      {
        q: 'Менің фотоларым сақтала ма?',
        a: 'Жоқ. Фото сіздің құрылғыңызда өңделеді және ешқайда жіберілмейді.',
      },
    ],

    footerProduct: '© 2026 Nexcel. Барлық құқықтар қорғалған.',
    footerPrivacy: 'Құпиялылық және қауіпсіздік',
    footerContact: 'Бізбен байланысу',
  },
}
