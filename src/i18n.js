export const translations = {
  ru: {

    stepNavigation: 'Навигация по шагам',
    stepProgress: 'Шаг {step} из 4',
    cameraStarting: 'Подключение камеры…',
    errUploadTooLarge: 'Выберите фото размером не более 50 МБ.',
    outOfFrame: 'Вне кадра',
    cropReady: 'Кадр сформирован',
    headEstimate: 'Голова: примерно {percent}% (норма {range}%)',
    selectAndContinue: 'Выбрать и продолжить',
    dimensionsAndLimit: '{w} × {h} px · до {max} КБ',
    jpegFormat: 'Формат: JPEG · без водяных знаков',
    exportPreparing: 'Подготовка JPEG…',
    exportFailedTitle: 'Не удалось подготовить JPEG',
    visualCheck: 'Визуальный контроль',
    checkingPhoto: 'Выполняется проверка параметров…',
    checkUnavailable: 'Автоматическая проверка изображения недоступна.',
    errSmallFace: 'Лицо слишком маленькое. Подойдите ближе или обрежьте фото перед загрузкой.',

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
    btnShootCamera: 'Снять на камеру',
    btnChooseFile: 'Выбрать файл',
    tipsToggle: 'Как сделать правильное фото',

    // Camera Capture Modal
    cameraModalTitle: 'Съёмка с камеры',
    cameraClose: 'Закрыть',
    cameraSwitch: 'Сменить камеру',
    cameraShoot: 'Снять через 3 с',
    cameraCancelCountdown: 'Отмена',
    cameraCountdown: 'Снимок через {sec}...',
    cameraGuideOval: 'Поместите лицо в овал, глаза — по линии',
    cameraEyeLine: 'Линия глаз',
    cameraErrNotAllowedTitle: 'Доступ к камере запрещён',
    cameraErrNotAllowedDesc: 'Разрешите доступ к камере в настройках браузера или выберите готовое фото.',
    cameraErrNotFoundTitle: 'Камера не найдена',
    cameraErrNotFoundDesc: 'Камера не обнаружена на устройстве. Подключите камеру или выберите файл.',
    cameraErrNotReadableTitle: 'Камера недоступна',
    cameraErrNotReadableDesc: 'Камера занята другим приложением. Закройте другие программы или выберите файл.',
    cameraErrGenericTitle: 'Ошибка камеры',
    cameraErrGenericDesc: 'Не удалось включить камеру. Попробуйте выбрать фото с устройства.',

    // Step 2
    step2Title: 'Выберите документ',
    step2Subtitle: 'Проверьте мини-превью: фото уже кадрировано под требования',
    outOfBoundsCard: 'Нужно больше места вокруг головы',

    // Step 3
    step3Title: 'Проверка и подстройка',
    step3Subtitle: 'Убедитесь, что лицо в кадре, или отрегулируйте ползунками',
    guideCorridor: 'Голова (макушка — подбородок) должна быть внутри коридора',
    guideChin: 'Подбородок',

    // Step 4
    step4Title: 'Фото готово к скачиванию',
    step4Subtitle: 'Файл кадрирован и оптимизирован под требования документа',
    btnDownloadJpeg: 'Скачать JPEG',
    btnOtherDoc: 'Другой документ',
    btnNewPhoto: 'Новое фото',

    // Privacy
    photoPrivacy: 'Фото обрабатывается на вашем устройстве и никуда не отправляется',
    cameraPrivacy: 'Видео с камеры не записывается и никуда не отправляется',

    // How to shoot tips
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
    uploadDrag: 'Перетащите фото сюда',
    uploadOr: 'или',
    uploadHint: 'JPG, PNG, WebP · до 50 МБ',

    // Processing & Errors
    processingModel: 'Загрузка модели ИИ...',
    processingFace: 'Поиск лица и кадрирование...',
    errNoFace: 'Лицо не обнаружено. Пожалуйста, загрузите чёткое фото лица анфас.',
    errNoFaceHint: 'Лицо должно занимать большую часть кадра: подойдите ближе или обрежьте фото, свет — спереди.',
    errMultipleFaces: 'Обнаружено несколько лиц. На фото должен быть только один человек.',
    errOutOfBounds: 'Отойдите дальше, вокруг головы нужно больше места.',
    errOutOfBoundsHint: 'Кадр выходит за границы фото. Уменьшите масштаб ползунком ниже.',
    errRead: 'Не удалось прочитать изображение. Попробуйте другой файл.',
    errUnsupportedFormat: 'Этот формат не поддерживается. Сохраните фото как JPG или PNG.',
    errFileTooLarge: 'Файл превышает лимит {max} КБ даже при сжатии. Попробуйте фото с меньшим количеством шумов.',

    // Result & Adjustments
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
    checkStatusGuide: 'Коридор',
    checkTiltOk: 'Наклон головы: ровно',
    checkTiltWarn: 'Наклон головы {deg}° (выровнен автоматически)',
    checkYawOk: 'Взгляд строго анфас',
    checkYawWarn: 'Голова слегка повернута в сторону',
    checkBrightnessOk: 'Освещение лица равномерное',
    checkBrightnessDark: 'Лицо темновато, добавьте свет',
    checkBrightnessBright: 'Лицо пересвечено, уменьшите свет',
    checkSharpnessOk: 'Резкость и четкость в норме',
    checkSharpnessWarn: 'Возможно, фото размыто или не в фокусе',
    checkHeadNeutral: 'Размер головы: примерно {pct}% — проверьте по направляющим',
    checkBgOk: 'Фон светлый и однотонный',
    checkBgWarn: 'Фон должен быть светлым и однотонным',
    checkEyesOk: 'Глаза открыты',
    checkEyesWarn: 'Глаза закрыты',
    checkMouthOk: 'Рот закрыт',
    checkMouthWarn: 'Рот открыт',

    // Manual checks
    manualGlasses: 'Без бликов на очках',
    manualMouth: 'Рот закрыт, выражение нейтральное',
    manualShadows: 'Нет теней на лице и фоне',
    manualBg: 'Светлый однотонный фон',

    // FAQ

    site: {
      skipToWizard: 'Перейти к мастеру',
      photoService: 'Фото на документы',
      navigation: 'Основная навигация',
      languages: 'Выбор языка',
      openMenu: 'Открыть меню',
      closeMenu: 'Закрыть меню',
      services: 'Услуги',
      company: 'Компания',
      contacts: 'Контакты',
      writeWhatsApp: 'Написать в WhatsApp: {phone}',
      links: {
        excel: 'Автоматизация Excel и Google Sheets',
        bots: 'Telegram + ИИ',
        ai: 'Внедрение ИИ',
        licensing: 'Лицензии ПО',
        seo: 'GEO-оптимизация',
        calculator: 'Калькулятор окупаемости',
        templates: 'Шаблоны',
        news: 'Кейсы и статьи',
        about: 'О компании',
        partners: 'Официальные партнёры',
        faq: 'FAQ',
      },
      footerServices: {
        excel: 'Автоматизация Excel',
        bots: 'Telegram-боты',
        licensing: 'Лицензии ПО & SaaS',
      },
      description: 'Автоматизируем отчёты, учёт и заявки для бизнеса в Казахстане. Разрабатываем Telegram-ботов, внедряем ИИ и поставляем лицензии на ПО.',
      learnMore: 'Подробнее о компании',
      documentsBadge: 'ЭСФ / АВР',
      paymentBadge: 'Оплата в ₸',
      socials: 'Мы в соцсетях',
      socialAccount: 'Nexcel Solutions в {network}',
      location: 'г. Астана, Казахстан',
      map: 'Мы на Google Картах',
      legalAddress: 'Юридический адрес:',
      director: 'Руководитель:',
      copyright: '© 2026 Nexcel Solutions. Все права защищены.',
      privacy: 'Политика конфиденциальности',
      paymentTerms: 'Работа по договору • Расчеты в тенге (KZT) • ЭСФ и АВР через ИС ЭСФ',
      logoRights: 'Логотипы принадлежат их правообладателям.',
    },
  },

  kz: {

    stepNavigation: 'Қадамдар бойынша өту',
    stepProgress: '4 қадамның {step}-қадамы',
    cameraStarting: 'Камера қосылып жатыр…',
    errUploadTooLarge: 'Көлемі 50 МБ-тан аспайтын фотоны таңдаңыз.',
    outOfFrame: 'Кадрдан тыс',
    cropReady: 'Кадр дайын',
    headEstimate: 'Бас: шамамен {percent}% (қалыпты аралық {range}%)',
    selectAndContinue: 'Таңдап, жалғастыру',
    dimensionsAndLimit: '{w} × {h} px · {max} КБ-қа дейін',
    jpegFormat: 'Пішімі: JPEG · сутаңбасыз',
    exportPreparing: 'JPEG дайындалып жатыр…',
    exportFailedTitle: 'JPEG файлын дайындау мүмкін болмады',
    visualCheck: 'Көзбен тексеру',
    checkingPhoto: 'Параметрлер тексеріліп жатыр…',
    checkUnavailable: 'Фотоны автоматты түрде тексеру мүмкін болмады.',
    errSmallFace: 'Бет тым кішкентай. Жақындап түсіріңіз немесе жүктемес бұрын фотоны қиыңыз.',

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
    btnShootCamera: 'Камерамен түсіру',
    btnChooseFile: 'Файлды таңдау',
    tipsToggle: 'Дұрыс фотоны қалай түсіру керек',

    // Camera Capture Modal
    cameraModalTitle: 'Камерамен түсіру',
    cameraClose: 'Жабу',
    cameraSwitch: 'Камераны ауыстыру',
    cameraShoot: '3 с кейін түсіру',
    cameraCancelCountdown: 'Болдырмау',
    cameraCountdown: 'Түсіруге {sec} сек...',
    cameraGuideOval: 'Бетті овалға, көзді сызыққа сәйкестендіріңіз',
    cameraEyeLine: 'Көз сызығы',
    cameraErrNotAllowedTitle: 'Камераға рұқсат берілмеген',
    cameraErrNotAllowedDesc: 'Браузер баптауларында камераға рұқсат беріңіз немесе дайын фотоны таңдаңыз.',
    cameraErrNotFoundTitle: 'Камера табылмады',
    cameraErrNotFoundDesc: 'Құрылғыңызда камера табылмады. Камераны қосыңыз немесе файлды таңдаңыз.',
    cameraErrNotReadableTitle: 'Камера қолжетімсіз',
    cameraErrNotReadableDesc: 'Камера басқа қолданбада қолданылуда. Басқа қолданбаларды жабыңыз немесе файлды таңдаңыз.',
    cameraErrGenericTitle: 'Камера қатесі',
    cameraErrGenericDesc: 'Камераны қосу мүмкін болмады. Құрылғыдан фото таңдап көріңіз.',

    // Step 2
    step2Title: 'Құжатты таңдаңыз',
    step2Subtitle: 'Алдын ала қарау: фото талаптарға сай кадрланған',
    outOfBoundsCard: 'Бас айналасында көбірек орын қажет',

    // Step 3
    step3Title: 'Тексеру және баптау',
    step3Subtitle: 'Беттің дұрыс орналасқанына көз жеткізіңіз немесе сырғытпалармен реттеңіз',
    guideCorridor: 'Бас (төбесі — иегі) дәліздің ішінде болуы керек',
    guideChin: 'Иек',

    // Step 4
    step4Title: 'Фото жүктеп алуға дайын',
    step4Subtitle: 'Файл кадрланды және құжат талаптарына сай оңтайландырылды',
    btnDownloadJpeg: 'JPEG жүктеп алу',
    btnOtherDoc: 'Басқа құжат',
    btnNewPhoto: 'Жаңа фото',

    // Privacy
    photoPrivacy: 'Фото сіздің құрылғыңызда өңделеді және ешқайда жіберілмейді',
    cameraPrivacy: 'Камерадағы бейне жазылмайды және ешқайда жіберілмейді',

    // How to shoot tips
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

    uploadDrag: 'Фотоны осында сүйреңіз',
    uploadOr: 'немесе',
    uploadHint: 'JPG, PNG, WebP · 50 МБ-қа дейін',

    // Processing & Errors
    processingModel: 'ЖИ моделі жүктелуде...',
    processingFace: 'Бетті анықтау және кадрлау...',
    errNoFace: 'Бет анықталмады. Бетті анық көрсететін фото жүктеңіз.',
    errNoFaceHint: 'Бет кадрдың негізгі бөлігін алуы тиіс: жақынырақ тұрыңыз немесе фотоны қиыңыз, жарық — алдынан.',
    errMultipleFaces: 'Бірнеше адам табылды. Фотода тек бір адам болуы керек.',
    errOutOfBounds: 'Алысырақ тұрыңыз, бас айналасында көбірек орын қажет.',
    errOutOfBoundsHint: 'Кадр фото шекарасынан шығып тұр. Төмендегі сырғытпамен масштабты азайтыңыз.',
    errRead: 'Суретті оқу мүмкін болмады. Басқа файлды байқап көріңіз.',
    errUnsupportedFormat: 'Бұл форматқа қолдау көрсетілмейді. Фотоны JPG немесе PNG ретінде сақтаңыз.',
    errFileTooLarge: 'Файл сығудан кейін де {max} КБ лимитінен асып тұр. Фон біркелкі фотоны байқап көріңіз.',

    // Result & Adjustments
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
    checkStatusGuide: 'Дәліз',
    checkTiltOk: 'Бастың еңкеюі: дұрыс',
    checkTiltWarn: 'Бастың еңкеюі {deg}° (автоматты түзелді)',
    checkYawOk: 'Тіке алдынан қараған',
    checkYawWarn: 'Бас сәл бір жаққа бұрылған',
    checkBrightnessOk: 'Беттің жарығы біркелкі',
    checkBrightnessDark: 'Бет қараңғылау, жарық қосыңыз',
    checkBrightnessBright: 'Бет тым жарық, жарықты азайтыңыз',
    checkSharpnessOk: 'Анықтылығы жақсы',
    checkSharpnessWarn: 'Фото бұлыңғыр болуы мүмкін',
    checkHeadNeutral: 'Бас өлшемі: шамамен {pct}% — бағыттауыштар бойынша тексеріңіз',
    checkBgOk: 'Фон ашық түсті және біркелкі',
    checkBgWarn: 'Фон ашық түсті және біркелкі болуы керек',
    checkEyesOk: 'Көздер ашық',
    checkEyesWarn: 'Көздер жабық',
    checkMouthOk: 'Ауыз жабық',
    checkMouthWarn: 'Ауыз ашық',

    // Manual checks
    manualGlasses: 'Көзәйнекте шағылысу жоқ',
    manualMouth: 'Ауыз жабық, бейтарап көрініс',
    manualShadows: 'Бетте және фонда көлеңке жоқ',
    manualBg: 'Ашық түсті біркелкі фон',

    site: {
      skipToWizard: 'Фото дайындауға өту',
      photoService: 'Құжатқа фото',
      navigation: 'Негізгі навигация',
      languages: 'Тілді таңдау',
      openMenu: 'Мәзірді ашу',
      closeMenu: 'Мәзірді жабу',
      services: 'Қызметтер',
      company: 'Компания',
      contacts: 'Байланыс',
      writeWhatsApp: 'WhatsApp арқылы жазу: {phone}',
      links: {
        excel: 'Excel және Google Sheets автоматтандыру',
        bots: 'Telegram + ЖИ',
        ai: 'ЖИ енгізу',
        licensing: 'БҚ лицензиялары',
        seo: 'GEO оңтайландыру',
        calculator: 'Өтелімділік калькуляторы',
        templates: 'Үлгілер',
        news: 'Жобалар мен мақалалар',
        about: 'Компания туралы',
        partners: 'Ресми серіктестер',
        faq: 'Жиі қойылатын сұрақтар',
      },
      footerServices: {
        excel: 'Excel автоматтандыру',
        bots: 'Telegram-боттар',
        licensing: 'БҚ және SaaS лицензиялары',
      },
      description: 'Қазақстандағы бизнес үшін есептерді, есепке алуды және өтінімдерді автоматтандырамыз. Telegram-боттар әзірлейміз, ЖИ енгіземіз және бағдарламалық жасақтама лицензияларын ұсынамыз.',
      learnMore: 'Компания туралы толығырақ',
      documentsBadge: 'ЭШФ / ОЖА',
      paymentBadge: 'Төлем ₸-мен',
      socials: 'Біз әлеуметтік желілердеміз',
      socialAccount: 'Nexcel Solutions — {network}',
      location: 'Астана қ., Қазақстан',
      map: 'Google Maps-тегі мекенжайымыз',
      legalAddress: 'Заңды мекенжайы:',
      director: 'Басшысы:',
      copyright: '© 2026 Nexcel Solutions. Барлық құқықтар қорғалған.',
      privacy: 'Құпиялылық саясаты',
      paymentTerms: 'Шарт бойынша жұмыс • Теңгемен есеп айырысу (KZT) • ЭШФ АЖ арқылы ЭШФ және ОЖА',
      logoRights: 'Логотиптер құқық иелеріне тиесілі.',
    },
  },
}
