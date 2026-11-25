// 中華郵政 3 碼郵遞區號資料庫 (涵蓋全台 22 縣市、368 鄉鎮市區) 與智慧地址解析器

export interface DistrictPostal {
  id?: string;
  cityId?: string;
  city: string;
  district: string;
  postalCode: string;
  isActive?: boolean;
  aliases?: string[];
  replacedByCity?: string;
  replacedByDistrict?: string;
  note?: string;
  sortOrder?: number;
}

export interface CityPostalMeta {
  id?: string;
  cityName: string;
  aliases: string[];
  isActive?: boolean;
  note?: string;
}

export const DEFAULT_TAIWAN_POSTAL_CODES: DistrictPostal[] = [
  // 臺北市
  { city: '臺北市', district: '中正區', postalCode: '100' },
  { city: '臺北市', district: '大同區', postalCode: '103' },
  { city: '臺北市', district: '中山區', postalCode: '104' },
  { city: '臺北市', district: '松山區', postalCode: '105' },
  { city: '臺北市', district: '大安區', postalCode: '106' },
  { city: '臺北市', district: '萬華區', postalCode: '108' },
  { city: '臺北市', district: '信義區', postalCode: '110' },
  { city: '臺北市', district: '士林區', postalCode: '111' },
  { city: '臺北市', district: '北投區', postalCode: '112' },
  { city: '臺北市', district: '內湖區', postalCode: '114' },
  { city: '臺北市', district: '南港區', postalCode: '115' },
  { city: '臺北市', district: '文山區', postalCode: '116' },

  // 新北市
  { city: '新北市', district: '萬里區', postalCode: '207' },
  { city: '新北市', district: '金山區', postalCode: '208' },
  { city: '新北市', district: '板橋區', postalCode: '220' },
  { city: '新北市', district: '汐止區', postalCode: '221' },
  { city: '新北市', district: '深坑區', postalCode: '222' },
  { city: '新北市', district: '石碇區', postalCode: '223' },
  { city: '新北市', district: '瑞芳區', postalCode: '224' },
  { city: '新北市', district: '平溪區', postalCode: '226' },
  { city: '新北市', district: '雙溪區', postalCode: '227' },
  { city: '新北市', district: '貢寮區', postalCode: '228' },
  { city: '新北市', district: '新店區', postalCode: '231' },
  { city: '新北市', district: '坪林區', postalCode: '232' },
  { city: '新北市', district: '烏來區', postalCode: '233' },
  { city: '新北市', district: '永和區', postalCode: '234' },
  { city: '新北市', district: '中和區', postalCode: '235' },
  { city: '新北市', district: '土城區', postalCode: '236' },
  { city: '新北市', district: '三峽區', postalCode: '237' },
  { city: '新北市', district: '樹林區', postalCode: '238' },
  { city: '新北市', district: '鶯歌區', postalCode: '239' },
  { city: '新北市', district: '三重區', postalCode: '241' },
  { city: '新北市', district: '新莊區', postalCode: '242' },
  { city: '新北市', district: '泰山區', postalCode: '243' },
  { city: '新北市', district: '林口區', postalCode: '244' },
  { city: '新北市', district: '蘆洲區', postalCode: '247' },
  { city: '新北市', district: '五股區', postalCode: '248' },
  { city: '新北市', district: '八里區', postalCode: '249' },
  { city: '新北市', district: '淡水區', postalCode: '251' },
  { city: '新北市', district: '三芝區', postalCode: '252' },
  { city: '新北市', district: '石門區', postalCode: '253' },

  // 基隆市
  { city: '基隆市', district: '仁愛區', postalCode: '200' },
  { city: '基隆市', district: '信義區', postalCode: '201' },
  { city: '基隆市', district: '中正區', postalCode: '202' },
  { city: '基隆市', district: '中山區', postalCode: '203' },
  { city: '基隆市', district: '安樂區', postalCode: '204' },
  { city: '基隆市', district: '暖暖區', postalCode: '205' },
  { city: '基隆市', district: '七堵區', postalCode: '206' },

  // 桃園市
  { city: '桃園市', district: '中壢區', postalCode: '320' },
  { city: '桃園市', district: '平鎮區', postalCode: '324' },
  { city: '桃園市', district: '龍潭區', postalCode: '325' },
  { city: '桃園市', district: '楊梅區', postalCode: '326' },
  { city: '桃園市', district: '新屋區', postalCode: '327' },
  { city: '桃園市', district: '觀音區', postalCode: '328' },
  { city: '桃園市', district: '桃園區', postalCode: '330' },
  { city: '桃園市', district: '龜山區', postalCode: '333' },
  { city: '桃園市', district: '八德區', postalCode: '334' },
  { city: '桃園市', district: '大溪區', postalCode: '335' },
  { city: '桃園市', district: '復興區', postalCode: '336' },
  { city: '桃園市', district: '大園區', postalCode: '337' },
  { city: '桃園市', district: '蘆竹區', postalCode: '338' },

  // 新竹市
  { city: '新竹市', district: '東區', postalCode: '300' },
  { city: '新竹市', district: '北區', postalCode: '300' },
  { city: '新竹市', district: '香山區', postalCode: '300' },

  // 新竹縣
  { city: '新竹縣', district: '竹北市', postalCode: '302' },
  { city: '新竹縣', district: '湖口鄉', postalCode: '303' },
  { city: '新竹縣', district: '新豐鄉', postalCode: '304' },
  { city: '新竹縣', district: '新埔鎮', postalCode: '305' },
  { city: '新竹縣', district: '關西鎮', postalCode: '306' },
  { city: '新竹縣', district: '芎林鄉', postalCode: '307' },
  { city: '新竹縣', district: '寶山鄉', postalCode: '308' },
  { city: '新竹縣', district: '竹東鎮', postalCode: '310' },
  { city: '新竹縣', district: '五峰鄉', postalCode: '311' },
  { city: '新竹縣', district: '橫山鄉', postalCode: '312' },
  { city: '新竹縣', district: '尖石鄉', postalCode: '313' },
  { city: '新竹縣', district: '北埔鄉', postalCode: '314' },
  { city: '新竹縣', district: '峨眉鄉', postalCode: '315' },

  // 苗栗縣
  { city: '苗栗縣', district: '竹南鎮', postalCode: '350' },
  { city: '苗栗縣', district: '頭份市', postalCode: '351' },
  { city: '苗栗縣', district: '三灣鄉', postalCode: '352' },
  { city: '苗栗縣', district: '南庄鄉', postalCode: '353' },
  { city: '苗栗縣', district: '獅潭鄉', postalCode: '354' },
  { city: '苗栗縣', district: '後龍鎮', postalCode: '356' },
  { city: '苗栗縣', district: '通霄鎮', postalCode: '357' },
  { city: '苗栗縣', district: '苑裡鎮', postalCode: '358' },
  { city: '苗栗縣', district: '苗栗市', postalCode: '360' },
  { city: '苗栗縣', district: '造橋鄉', postalCode: '361' },
  { city: '苗栗縣', district: '頭屋鄉', postalCode: '362' },
  { city: '苗栗縣', district: '公館鄉', postalCode: '363' },
  { city: '苗栗縣', district: '大湖鄉', postalCode: '364' },
  { city: '苗栗縣', district: '泰安鄉', postalCode: '365' },
  { city: '苗栗縣', district: '銅鑼鄉', postalCode: '366' },
  { city: '苗栗縣', district: '三義鄉', postalCode: '367' },
  { city: '苗栗縣', district: '西湖鄉', postalCode: '368' },
  { city: '苗栗縣', district: '卓蘭鎮', postalCode: '369' },

  // 臺中市
  { city: '臺中市', district: '中區', postalCode: '400' },
  { city: '臺中市', district: '東區', postalCode: '401' },
  { city: '臺中市', district: '南區', postalCode: '402' },
  { city: '臺中市', district: '西區', postalCode: '403' },
  { city: '臺中市', district: '北區', postalCode: '404' },
  { city: '臺中市', district: '北屯區', postalCode: '406' },
  { city: '臺中市', district: '西屯區', postalCode: '407' },
  { city: '臺中市', district: '南屯區', postalCode: '408' },
  { city: '臺中市', district: '太平區', postalCode: '411' },
  { city: '臺中市', district: '大里區', postalCode: '412' },
  { city: '臺中市', district: '霧峰區', postalCode: '413' },
  { city: '臺中市', district: '烏日區', postalCode: '414' },
  { city: '臺中市', district: '豐原區', postalCode: '420' },
  { city: '臺中市', district: '后里區', postalCode: '421' },
  { city: '臺中市', district: '石岡區', postalCode: '422' },
  { city: '臺中市', district: '東勢區', postalCode: '423' },
  { city: '臺中市', district: '和平區', postalCode: '424' },
  { city: '臺中市', district: '新社區', postalCode: '426' },
  { city: '臺中市', district: '潭子區', postalCode: '427' },
  { city: '臺中市', district: '大雅區', postalCode: '428' },
  { city: '臺中市', district: '神岡區', postalCode: '429' },
  { city: '臺中市', district: '大肚區', postalCode: '432' },
  { city: '臺中市', district: '沙鹿區', postalCode: '433' },
  { city: '臺中市', district: '龍井區', postalCode: '434' },
  { city: '臺中市', district: '梧棲區', postalCode: '435' },
  { city: '臺中市', district: '清水區', postalCode: '436' },
  { city: '臺中市', district: '大甲區', postalCode: '437' },
  { city: '臺中市', district: '外埔區', postalCode: '438' },
  { city: '臺中市', district: '大安區', postalCode: '439' },

  // 彰化縣
  { city: '彰化縣', district: '彰化市', postalCode: '500' },
  { city: '彰化縣', district: '芬園鄉', postalCode: '502' },
  { city: '彰化縣', district: '花壇鄉', postalCode: '503' },
  { city: '彰化縣', district: '秀水鄉', postalCode: '504' },
  { city: '彰化縣', district: '鹿港鎮', postalCode: '505' },
  { city: '彰化縣', district: '福興鄉', postalCode: '506' },
  { city: '彰化縣', district: '線西鄉', postalCode: '507' },
  { city: '彰化縣', district: '和美鎮', postalCode: '508' },
  { city: '彰化縣', district: '伸港鄉', postalCode: '509' },
  { city: '彰化縣', district: '員林市', postalCode: '510' },
  { city: '彰化縣', district: '社頭鄉', postalCode: '511' },
  { city: '彰化縣', district: '永靖鄉', postalCode: '512' },
  { city: '彰化縣', district: '埔心鄉', postalCode: '513' },
  { city: '彰化縣', district: '溪湖鎮', postalCode: '514' },
  { city: '彰化縣', district: '大村鄉', postalCode: '515' },
  { city: '彰化縣', district: '埔鹽鄉', postalCode: '516' },
  { city: '彰化縣', district: '田中鎮', postalCode: '520' },
  { city: '彰化縣', district: '北斗鎮', postalCode: '521' },
  { city: '彰化縣', district: '田尾鄉', postalCode: '522' },
  { city: '彰化縣', district: '埤頭鄉', postalCode: '523' },
  { city: '彰化縣', district: '溪州鄉', postalCode: '524' },
  { city: '彰化縣', district: '竹塘鄉', postalCode: '525' },
  { city: '彰化縣', district: '二林鎮', postalCode: '526' },
  { city: '彰化縣', district: '大城鄉', postalCode: '527' },
  { city: '彰化縣', district: '芳苑鄉', postalCode: '528' },
  { city: '彰化縣', district: '二水鄉', postalCode: '530' },

  // 南投縣
  { city: '南投縣', district: '南投市', postalCode: '540' },
  { city: '南投縣', district: '中寮鄉', postalCode: '541' },
  { city: '南投縣', district: '草屯鎮', postalCode: '542' },
  { city: '南投縣', district: '國姓鄉', postalCode: '544' },
  { city: '南投縣', district: '埔里鎮', postalCode: '545' },
  { city: '南投縣', district: '仁愛鄉', postalCode: '546' },
  { city: '南投縣', district: '名間鄉', postalCode: '551' },
  { city: '南投縣', district: '集集鎮', postalCode: '552' },
  { city: '南投縣', district: '水里鄉', postalCode: '553' },
  { city: '南投縣', district: '魚池鄉', postalCode: '555' },
  { city: '南投縣', district: '信義鄉', postalCode: '556' },
  { city: '南投縣', district: '竹山鎮', postalCode: '557' },
  { city: '南投縣', district: '鹿谷鄉', postalCode: '558' },

  // 嘉義市
  { city: '嘉義市', district: '東區', postalCode: '600' },
  { city: '嘉義市', district: '西區', postalCode: '600' },

  // 嘉義縣
  { city: '嘉義縣', district: '番路鄉', postalCode: '602' },
  { city: '嘉義縣', district: '梅山鄉', postalCode: '603' },
  { city: '嘉義縣', district: '竹崎鄉', postalCode: '604' },
  { city: '嘉義縣', district: '阿里山鄉', postalCode: '605' },
  { city: '嘉義縣', district: '中埔鄉', postalCode: '606' },
  { city: '嘉義縣', district: '大埔鄉', postalCode: '607' },
  { city: '嘉義縣', district: '水上鄉', postalCode: '608' },
  { city: '嘉義縣', district: '鹿草鄉', postalCode: '611' },
  { city: '嘉義縣', district: '太保市', postalCode: '612' },
  { city: '嘉義縣', district: '朴子市', postalCode: '613' },
  { city: '嘉義縣', district: '東石鄉', postalCode: '614' },
  { city: '嘉義縣', district: '六腳鄉', postalCode: '615' },
  { city: '嘉義縣', district: '新港鄉', postalCode: '616' },
  { city: '嘉義縣', district: '民雄鄉', postalCode: '621' },
  { city: '嘉義縣', district: '大林鎮', postalCode: '622' },
  { city: '嘉義縣', district: '溪口鄉', postalCode: '623' },
  { city: '嘉義縣', district: '義竹鄉', postalCode: '624' },
  { city: '嘉義縣', district: '布袋鎮', postalCode: '625' },

  // 雲林縣
  { city: '雲林縣', district: '斗南鎮', postalCode: '630' },
  { city: '雲林縣', district: '大埤鄉', postalCode: '631' },
  { city: '雲林縣', district: '虎尾鎮', postalCode: '632' },
  { city: '雲林縣', district: '土庫鎮', postalCode: '633' },
  { city: '雲林縣', district: '褒忠鄉', postalCode: '634' },
  { city: '雲林縣', district: '東勢鄉', postalCode: '635' },
  { city: '雲林縣', district: '臺西鄉', postalCode: '636' },
  { city: '雲林縣', district: '崙背鄉', postalCode: '637' },
  { city: '雲林縣', district: '麥寮鄉', postalCode: '638' },
  { city: '雲林縣', district: '斗六市', postalCode: '640' },
  { city: '雲林縣', district: '林內鄉', postalCode: '643' },
  { city: '雲林縣', district: '古坑鄉', postalCode: '646' },
  { city: '雲林縣', district: '莿桐鄉', postalCode: '647' },
  { city: '雲林縣', district: '西螺鎮', postalCode: '648' },
  { city: '雲林縣', district: '二崙鄉', postalCode: '649' },
  { city: '雲林縣', district: '北港鎮', postalCode: '651' },
  { city: '雲林縣', district: '水林鄉', postalCode: '652' },
  { city: '雲林縣', district: '口湖鄉', postalCode: '653' },
  { city: '雲林縣', district: '四湖鄉', postalCode: '654' },
  { city: '雲林縣', district: '元長鄉', postalCode: '655' },

  // 臺南市
  { city: '臺南市', district: '中西區', postalCode: '700' },
  { city: '臺南市', district: '東區', postalCode: '701' },
  { city: '臺南市', district: '南區', postalCode: '702' },
  { city: '臺南市', district: '北區', postalCode: '704' },
  { city: '臺南市', district: '安平區', postalCode: '708' },
  { city: '臺南市', district: '安南區', postalCode: '709' },
  { city: '臺南市', district: '永康區', postalCode: '710' },
  { city: '臺南市', district: '歸仁區', postalCode: '711' },
  { city: '臺南市', district: '新化區', postalCode: '712' },
  { city: '臺南市', district: '左鎮區', postalCode: '713' },
  { city: '臺南市', district: '玉井區', postalCode: '714' },
  { city: '臺南市', district: '楠西區', postalCode: '715' },
  { city: '臺南市', district: '南化區', postalCode: '716' },
  { city: '臺南市', district: '仁德區', postalCode: '717' },
  { city: '臺南市', district: '關廟區', postalCode: '718' },
  { city: '臺南市', district: '龍崎區', postalCode: '719' },
  { city: '臺南市', district: '官田區', postalCode: '720' },
  { city: '臺南市', district: '麻豆區', postalCode: '721' },
  { city: '臺南市', district: '佳里區', postalCode: '722' },
  { city: '臺南市', district: '西港區', postalCode: '723' },
  { city: '臺南市', district: '七股區', postalCode: '724' },
  { city: '臺南市', district: '將軍區', postalCode: '725' },
  { city: '臺南市', district: '學甲區', postalCode: '726' },
  { city: '臺南市', district: '北門區', postalCode: '727' },
  { city: '臺南市', district: '新營區', postalCode: '730' },
  { city: '臺南市', district: '後壁區', postalCode: '731' },
  { city: '臺南市', district: '白河區', postalCode: '732' },
  { city: '臺南市', district: '東山區', postalCode: '733' },
  { city: '臺南市', district: '六甲區', postalCode: '734' },
  { city: '臺南市', district: '下營區', postalCode: '735' },
  { city: '臺南市', district: '柳營區', postalCode: '736' },
  { city: '臺南市', district: '鹽水區', postalCode: '737' },
  { city: '臺南市', district: '善化區', postalCode: '741' },
  { city: '臺南市', district: '大內區', postalCode: '742' },
  { city: '臺南市', district: '山上區', postalCode: '743' },
  { city: '臺南市', district: '新市區', postalCode: '744' },
  { city: '臺南市', district: '安定區', postalCode: '745' },

  // 高雄市
  { city: '高雄市', district: '新興區', postalCode: '800' },
  { city: '高雄市', district: '前金區', postalCode: '801' },
  { city: '高雄市', district: '苓雅區', postalCode: '802' },
  { city: '高雄市', district: '鹽埕區', postalCode: '803' },
  { city: '高雄市', district: '鼓山區', postalCode: '804' },
  { city: '高雄市', district: '旗津區', postalCode: '805' },
  { city: '高雄市', district: '前鎮區', postalCode: '806' },
  { city: '高雄市', district: '三民區', postalCode: '807' },
  { city: '高雄市', district: '楠梓區', postalCode: '811' },
  { city: '高雄市', district: '小港區', postalCode: '812' },
  { city: '高雄市', district: '左營區', postalCode: '813' },
  { city: '高雄市', district: '仁武區', postalCode: '814' },
  { city: '高雄市', district: '大社區', postalCode: '815' },
  { city: '高雄市', district: '岡山區', postalCode: '820' },
  { city: '高雄市', district: '路竹區', postalCode: '821' },
  { city: '高雄市', district: '阿蓮區', postalCode: '822' },
  { city: '高雄市', district: '田寮區', postalCode: '823' },
  { city: '高雄市', district: '燕巢區', postalCode: '824' },
  { city: '高雄市', district: '橋頭區', postalCode: '825' },
  { city: '高雄市', district: '梓官區', postalCode: '826' },
  { city: '高雄市', district: '彌陀區', postalCode: '827' },
  { city: '高雄市', district: '永安區', postalCode: '828' },
  { city: '高雄市', district: '湖內區', postalCode: '829' },
  { city: '高雄市', district: '鳳山區', postalCode: '830' },
  { city: '高雄市', district: '大寮區', postalCode: '831' },
  { city: '高雄市', district: '林園區', postalCode: '832' },
  { city: '高雄市', district: '鳥松區', postalCode: '833' },
  { city: '高雄市', district: '大樹區', postalCode: '840' },
  { city: '高雄市', district: '旗山區', postalCode: '842' },
  { city: '高雄市', district: '美濃區', postalCode: '843' },
  { city: '高雄市', district: '六龜區', postalCode: '844' },
  { city: '高雄市', district: '內門區', postalCode: '845' },
  { city: '高雄市', district: '杉林區', postalCode: '846' },
  { city: '高雄市', district: '甲仙區', postalCode: '847' },
  { city: '高雄市', district: '桃源區', postalCode: '848' },
  { city: '高雄市', district: '那瑪夏區', postalCode: '849' },
  { city: '高雄市', district: '茂林區', postalCode: '851' },
  { city: '高雄市', district: '茄萣區', postalCode: '852' },

  // 屏東縣
  { city: '屏東縣', district: '屏東市', postalCode: '900' },
  { city: '屏東縣', district: '三地門鄉', postalCode: '901' },
  { city: '屏東縣', district: '霧臺鄉', postalCode: '902' },
  { city: '屏東縣', district: '瑪家鄉', postalCode: '903' },
  { city: '屏東縣', district: '九如鄉', postalCode: '904' },
  { city: '屏東縣', district: '里港鄉', postalCode: '905' },
  { city: '屏東縣', district: '高樹鄉', postalCode: '906' },
  { city: '屏東縣', district: '鹽埔鄉', postalCode: '907' },
  { city: '屏東縣', district: '長治鄉', postalCode: '908' },
  { city: '屏東縣', district: '麟洛鄉', postalCode: '909' },
  { city: '屏東縣', district: '竹田鄉', postalCode: '911' },
  { city: '屏東縣', district: '內埔鄉', postalCode: '912' },
  { city: '屏東縣', district: '萬丹鄉', postalCode: '913' },
  { city: '屏東縣', district: '潮州鎮', postalCode: '920' },
  { city: '屏東縣', district: '泰武鄉', postalCode: '921' },
  { city: '屏東縣', district: '來義鄉', postalCode: '922' },
  { city: '屏東縣', district: '萬巒鄉', postalCode: '923' },
  { city: '屏東縣', district: '崁頂鄉', postalCode: '924' },
  { city: '屏東縣', district: '新埤鄉', postalCode: '925' },
  { city: '屏東縣', district: '南州鄉', postalCode: '926' },
  { city: '屏東縣', district: '林邊鄉', postalCode: '927' },
  { city: '屏東縣', district: '東港鎮', postalCode: '928' },
  { city: '屏東縣', district: '琉球鄉', postalCode: '929' },
  { city: '屏東縣', district: '佳冬鄉', postalCode: '931' },
  { city: '屏東縣', district: '新園鄉', postalCode: '932' },
  { city: '屏東縣', district: '枋寮鄉', postalCode: '940' },
  { city: '屏東縣', district: '枋山鄉', postalCode: '941' },
  { city: '屏東縣', district: '春日鄉', postalCode: '942' },
  { city: '屏東縣', district: '獅子鄉', postalCode: '943' },
  { city: '屏東縣', district: '車城鄉', postalCode: '944' },
  { city: '屏東縣', district: '牡丹鄉', postalCode: '945' },
  { city: '屏東縣', district: '恆春鎮', postalCode: '946' },
  { city: '屏東縣', district: '滿州鄉', postalCode: '947' },

  // 宜蘭縣
  { city: '宜蘭縣', district: '宜蘭市', postalCode: '260' },
  { city: '宜蘭縣', district: '頭城鎮', postalCode: '261' },
  { city: '宜蘭縣', district: '礁溪鄉', postalCode: '262' },
  { city: '宜蘭縣', district: '壯圍鄉', postalCode: '263' },
  { city: '宜蘭縣', district: '員山鄉', postalCode: '264' },
  { city: '宜蘭縣', district: '羅東鎮', postalCode: '265' },
  { city: '宜蘭縣', district: '三星鄉', postalCode: '266' },
  { city: '宜蘭縣', district: '大同鄉', postalCode: '267' },
  { city: '宜蘭縣', district: '五結鄉', postalCode: '268' },
  { city: '宜蘭縣', district: '冬山鄉', postalCode: '269' },
  { city: '宜蘭縣', district: '蘇澳鎮', postalCode: '270' },
  { city: '宜蘭縣', district: '南澳鄉', postalCode: '272' },

  // 花蓮縣
  { city: '花蓮縣', district: '花蓮市', postalCode: '970' },
  { city: '花蓮縣', district: '新城鄉', postalCode: '971' },
  { city: '花蓮縣', district: '秀林鄉', postalCode: '972' },
  { city: '花蓮縣', district: '吉安鄉', postalCode: '973' },
  { city: '花蓮縣', district: '壽豐鄉', postalCode: '974' },
  { city: '花蓮縣', district: '鳳林鎮', postalCode: '975' },
  { city: '花蓮縣', district: '光復鄉', postalCode: '976' },
  { city: '花蓮縣', district: '豐濱鄉', postalCode: '977' },
  { city: '花蓮縣', district: '瑞穗鄉', postalCode: '978' },
  { city: '花蓮縣', district: '萬榮鄉', postalCode: '979' },
  { city: '花蓮縣', district: '玉里鎮', postalCode: '981' },
  { city: '花蓮縣', district: '卓溪鄉', postalCode: '982' },
  { city: '花蓮縣', district: '富里鄉', postalCode: '983' },

  // 臺東縣
  { city: '臺東縣', district: '臺東市', postalCode: '950' },
  { city: '臺東縣', district: '綠島鄉', postalCode: '951' },
  { city: '臺東縣', district: '蘭嶼鄉', postalCode: '952' },
  { city: '臺東縣', district: '延平鄉', postalCode: '953' },
  { city: '臺東縣', district: '卑南鄉', postalCode: '954' },
  { city: '臺東縣', district: '鹿野鄉', postalCode: '955' },
  { city: '臺東縣', district: '關山鎮', postalCode: '956' },
  { city: '臺東縣', district: '海端鄉', postalCode: '957' },
  { city: '臺東縣', district: '池上鄉', postalCode: '958' },
  { city: '臺東縣', district: '東河鄉', postalCode: '959' },
  { city: '臺東縣', district: '成功鎮', postalCode: '961' },
  { city: '臺東縣', district: '長濱鄉', postalCode: '962' },
  { city: '臺東縣', district: '太麻里鄉', postalCode: '963' },
  { city: '臺東縣', district: '金峰鄉', postalCode: '964' },
  { city: '臺東縣', district: '大武鄉', postalCode: '965' },
  { city: '臺東縣', district: '達仁鄉', postalCode: '966' },

  // 澎湖縣
  { city: '澎湖縣', district: '馬公市', postalCode: '880' },
  { city: '澎湖縣', district: '西嶼鄉', postalCode: '881' },
  { city: '澎湖縣', district: '望安鄉', postalCode: '882' },
  { city: '澎湖縣', district: '七美鄉', postalCode: '883' },
  { city: '澎湖縣', district: '白沙鄉', postalCode: '884' },
  { city: '澎湖縣', district: '湖西鄉', postalCode: '885' },

  // 金門縣
  { city: '金門縣', district: '金沙鎮', postalCode: '890' },
  { city: '金門縣', district: '金湖鎮', postalCode: '891' },
  { city: '金門縣', district: '金寧鄉', postalCode: '892' },
  { city: '金門縣', district: '金城鎮', postalCode: '893' },
  { city: '金門縣', district: '烈嶼鄉', postalCode: '894' },
  { city: '金門縣', district: '烏坵鄉', postalCode: '896' },

  // 連江縣 (馬祖)
  { city: '連江縣', district: '南竿鄉', postalCode: '209' },
  { city: '連江縣', district: '北竿鄉', postalCode: '210' },
  { city: '連江縣', district: '莒光鄉', postalCode: '211' },
  { city: '連江縣', district: '東引鄉', postalCode: '212' },
];

export const TAIWAN_POSTAL_CODES: DistrictPostal[] = DEFAULT_TAIWAN_POSTAL_CODES;

let dynamicCityCatalog: CityPostalMeta[] = Array.from(
  new Set(DEFAULT_TAIWAN_POSTAL_CODES.map(p => p.city))
).map((cityName, idx) => ({
  id: `CITY-${String(idx + 1).padStart(2, '0')}`,
  cityName,
  aliases: [],
  isActive: true
}));

let dynamicPostalCatalog: DistrictPostal[] = DEFAULT_TAIWAN_POSTAL_CODES.map((p, idx) => ({
  ...p,
  id: `POST-${String(idx + 1).padStart(3, '0')}`,
  isActive: true,
  aliases: [],
  sortOrder: idx + 1
}));

// 建立雙向別名快取（key: 正規化後的地名，value: 所有可互通的正規化地名陣列）
let aliasGraphCache: Map<string, string[]> | null = null;

function normTaiChar(text?: string): string {
  return (text || '').trim().replace(/台/g, '臺');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function invalidateAliasCache() {
  aliasGraphCache = null;
}

function parseZipNumeric(zip?: string): number {
  const digits = (zip || '').replace(/\D/g, '').slice(0, 6);
  if (!digits) return 999999;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 999999;
}

/**
 * 同一縣市內嚴格依「郵遞區號由小到大」排序（如 100 ➔ 103 ➔ 104 ... ➔ 116）
 */
export function compareDistrictPostal(a: DistrictPostal, b: DistrictPostal): number {
  const zipDiff = parseZipNumeric(a.postalCode) - parseZipNumeric(b.postalCode);
  if (zipDiff !== 0) return zipDiff;
  const codeCmp = (a.postalCode || '').localeCompare(b.postalCode || '', undefined, { numeric: true });
  if (codeCmp !== 0) return codeCmp;
  const sortDiff = (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
  if (sortDiff !== 0) return sortDiff;
  return (a.district || '').localeCompare(b.district || '', 'zh-Hant');
}

function sortCatalogByPostalCode(records: DistrictPostal[]): DistrictPostal[] {
  const cityMinZip = new Map<string, number>();
  for (const r of records) {
    const z = parseZipNumeric(r.postalCode);
    const prev = cityMinZip.get(r.city);
    if (prev === undefined || z < prev) {
      cityMinZip.set(r.city, z);
    }
  }
  return [...records].sort((a, b) => {
    if (a.city !== b.city) {
      const minA = cityMinZip.get(a.city) ?? 999999;
      const minB = cityMinZip.get(b.city) ?? 999999;
      if (minA !== minB) return minA - minB;
      return a.city.localeCompare(b.city, 'zh-Hant');
    }
    return compareDistrictPostal(a, b);
  });
}

function isCityActive(cityName: string): boolean {
  const norm = normTaiChar(cityName);
  const meta = dynamicCityCatalog.find(c => normTaiChar(c.cityName) === norm || c.cityName === cityName);
  return meta ? meta.isActive !== false : true;
}

function getAliasGraph(): Map<string, string[]> {
  if (aliasGraphCache) return aliasGraphCache;

  const edges = new Map<string, Set<string>>();
  const addPair = (aRaw?: string, bRaw?: string) => {
    const a = normTaiChar(aRaw);
    const b = normTaiChar(bRaw);
    if (!a || !b || a === b) return;
    if (!edges.has(a)) edges.set(a, new Set([a]));
    if (!edges.has(b)) edges.set(b, new Set([b]));
    edges.get(a)!.add(b);
    edges.get(b)!.add(a);
  };

  // 1. 縣市變數層級別名 (例如 臺北市 ↔ 台灣市、新北市 ↔ 臺北縣)
  for (const cMeta of dynamicCityCatalog) {
    const cNorm = normTaiChar(cMeta.cityName);
    const cityDistricts = dynamicPostalCatalog.filter(
      p => normTaiChar(p.city) === cNorm || (cMeta.id && p.cityId === cMeta.id)
    );
    for (const alias of cMeta.aliases || []) {
      const aNorm = normTaiChar(alias);
      if (!aNorm) continue;
      addPair(cNorm, aNorm);
      for (const distRow of cityDistricts) {
        const dNorm = normTaiChar(distRow.district);
        if (dNorm) {
          addPair(`${cNorm}${dNorm}`, `${aNorm}${dNorm}`);
        }
      }
    }
  }

  // 2. 行政區個別沿革與別名
  for (const item of dynamicPostalCatalog) {
    const c = normTaiChar(item.city);
    const d = normTaiChar(item.district);
    const rc = normTaiChar(item.replacedByCity);
    const rd = normTaiChar(item.replacedByDistrict);

    if (rc) {
      addPair(c, rc);
      if (rd) {
        addPair(`${c}${d}`, `${rc}${rd}`);
      }
    }
    if (rd) {
      addPair(d, rd);
    }

    for (const alias of item.aliases || []) {
      const a = normTaiChar(alias);
      if (!a) continue;
      if (a.length <= 4 && /[縣市]$/.test(a) && a !== d) {
        addPair(c, a);
        if (rc) addPair(rc, a);
      } else {
        addPair(d, a);
        addPair(`${c}${d}`, a);
        if (rd) addPair(rd, a);
        if (rc && rd) addPair(`${rc}${rd}`, a);
      }
    }
  }

  // 連通展開
  const graph = new Map<string, string[]>();
  for (const key of edges.keys()) {
    const visited = new Set<string>([key]);
    const queue = [key];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = edges.get(curr);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    graph.set(key, Array.from(visited));
  }

  aliasGraphCache = graph;
  return graph;
}

/**
 * 由 SQLite 資料庫層同步縣市層級變數清單 (taiwan_postal_cities)
 */
export function setDynamicCityCatalog(cities: CityPostalMeta[]): void {
  if (!cities || cities.length === 0) {
    dynamicCityCatalog = Array.from(
      new Set(DEFAULT_TAIWAN_POSTAL_CODES.map(p => p.city))
    ).map((cityName, idx) => ({
      id: `CITY-${String(idx + 1).padStart(2, '0')}`,
      cityName,
      aliases: [],
      isActive: true
    }));
  } else {
    dynamicCityCatalog = [...cities];
  }
  invalidateAliasCache();
}

export function getCityCatalog(options?: { includeInactive?: boolean }): CityPostalMeta[] {
  const includeInactive = options?.includeInactive ?? false;
  return includeInactive
    ? dynamicCityCatalog
    : dynamicCityCatalog.filter(c => c.isActive !== false);
}

/**
 * 由 SQLite 資料庫層同步最新的郵遞區號微型資料庫至記憶體快取（強制依郵遞區號由小到大排序）
 */
export function setDynamicPostalCatalog(records: DistrictPostal[]): void {
  if (!records || records.length === 0) {
    dynamicPostalCatalog = sortCatalogByPostalCode(
      DEFAULT_TAIWAN_POSTAL_CODES.map((p, idx) => ({
        ...p,
        id: `POST-${String(idx + 1).padStart(3, '0')}`,
        isActive: true,
        aliases: [],
        sortOrder: idx + 1
      }))
    );
  } else {
    dynamicPostalCatalog = sortCatalogByPostalCode(records);
  }
  invalidateAliasCache();
}

export function getPostalCatalog(options?: { includeInactive?: boolean }): DistrictPostal[] {
  const includeInactive = options?.includeInactive ?? false;
  return includeInactive
    ? dynamicPostalCatalog
    : dynamicPostalCatalog.filter(p => p.isActive !== false && isCityActive(p.city));
}

// 取得預設台灣所有縣市清單（保留靜態匯出向下相容）
export const TAIWAN_CITIES = Array.from(new Set(DEFAULT_TAIWAN_POSTAL_CODES.map(p => p.city)));

// 根據縣市取得該縣市所屬鄉鎮市區列表（固定依郵遞區號由小到大排序）
export function getDistrictsByCity(
  cityName: string,
  options?: { includeInactive?: boolean }
): DistrictPostal[] {
  if (!cityName) return [];
  const normCity = normalizeTaiwanCity(cityName);
  const pool = getPostalCatalog(options);
  return pool
    .filter(p => normTaiChar(p.city) === normCity || normTaiChar(p.city) === normTaiChar(cityName) || p.city === cityName.trim())
    .sort(compareDistrictPostal);
}

/**
 * 檢查輸入的縣市或行政區是否在郵局表已被標記為「歷史停用／改制」或已自現行表更名移轉
 */
export function findDeprecatedDistrictInfo(
  city?: string,
  district?: string
): DistrictPostal | undefined {
  const normC = normTaiChar(city);
  const normD = normTaiChar(district);
  if (!normC && !normD) return undefined;

  const inactiveRows = dynamicPostalCatalog.filter(
    p => p.isActive === false || !isCityActive(p.city)
  );
  if (normC && normD) {
    const exact = inactiveRows.find(
      p => normTaiChar(p.city) === normC && normTaiChar(p.district) === normD
    );
    if (exact) return exact;
  }
  if (normC) {
    const inactiveCityRow = inactiveRows.find(
      p =>
        normTaiChar(p.city) === normC ||
        (p.aliases || []).some(a => normTaiChar(a) === normC)
    );
    if (inactiveCityRow) return inactiveCityRow;

    // 若該舊縣市名稱出現在某現行縣市的「舊名別名」中，提醒可對應新縣市
    const aliasedCity = dynamicCityCatalog.find(
      c =>
        normTaiChar(c.cityName) !== normC &&
        (c.aliases || []).some(a => normTaiChar(a) === normC)
    );
    if (aliasedCity) {
      return {
        city: city || '',
        district: district || '',
        postalCode: '',
        isActive: false,
        replacedByCity: aliasedCity.cityName,
        replacedByDistrict: district || undefined,
        note: aliasedCity.note || `已更名為 ${aliasedCity.cityName}`
      };
    }
  }
  return undefined;
}

/**
 * 智慧地址解析器：給定一段完整地址，自動分析出縣市、鄉鎮市區與 3 碼郵遞區號
 * 優先比對現行啟用行政區，再比對歷史停用行政區與別名（同時相容 臺/台）
 */
export function parseTaiwanAddress(addressText?: string): {
  postalCode?: string;
  city?: string;
  district?: string;
  remaining?: string;
} {
  if (!addressText || !addressText.trim()) return {};

  // 1. 移除開頭帶括號的郵遞區號前綴 (如 [630]、(630)、（630）、【630】)
  const clean = addressText.trim().replace(/^[\[\(（【]\d{3,6}(?:-\d{2,3})?[\]\)）】]\s*/, '');

  // 2. 若整串純為 3~6 碼郵遞區號，嘗試反查縣市鄉鎮，剩餘住址維持空字串
  const pureZipMatch = clean.match(/^(\d{3})(?:-?\d{2,3})?$/);
  if (pureZipMatch) {
    const matched = getLocationsByPostalCode(pureZipMatch[1], { includeInactive: true });
    if (matched.length > 0) {
      return {
        postalCode: clean,
        city: matched[0].city,
        district: matched[0].district,
        remaining: ''
      };
    }
    return {
      postalCode: clean,
      remaining: ''
    };
  }

  // 3. 若開頭有未帶括號的 3~6 碼數字，先嘗試剝除後比對；唯有剝除後確能匹配縣市或鄉鎮時才視為郵遞區號前綴，避免誤刪 "100巷5號"
  const unbracketedZipMatch = clean.match(/^(\d{3,6}(?:-\d{2,3})?)\s*(.+)$/);
  const candidates: Array<{ text: string; leadZip?: string }> = unbracketedZipMatch
    ? [{ text: unbracketedZipMatch[2].trim(), leadZip: unbracketedZipMatch[1] }, { text: clean }]
    : [{ text: clean }];

  // 現行啟用優先，再檢索歷史停用
  const orderedCatalog = [
    ...dynamicPostalCatalog.filter(p => p.isActive !== false),
    ...dynamicPostalCatalog.filter(p => p.isActive === false)
  ];
  const allCities = getTaiwanCities(true);

  // 3a/3b 共用：建立縣市別名對照表（來自 taiwan_postal_cities 與各行政區別名）
  const cityMetaByNorm = new Map<string, CityPostalMeta>();
  for (const cMeta of dynamicCityCatalog) {
    cityMetaByNorm.set(normTaiChar(cMeta.cityName), cMeta);
  }

  for (const candidate of candidates) {
    const target = candidate.text;

    // 3a. 嘗試比對完整「縣市 + 行政區」（同時相容 臺/台 寫法與縣市變數別名）
    for (const item of orderedCatalog) {
      const cMeta = cityMetaByNorm.get(normTaiChar(item.city));
      const cityAliases = cMeta?.aliases || [];
      const cForms = Array.from(
        new Set([
          item.city,
          normTaiChar(item.city),
          item.city.replace(/臺/g, '台'),
          ...cityAliases.flatMap(a => [a, normTaiChar(a), a.replace(/臺/g, '台')]),
          ...(item.aliases || []).filter(a => a.length <= 4 && /[縣市]$/.test(a)).flatMap(a => [a, normTaiChar(a), a.replace(/臺/g, '台')])
        ])
      ).filter(Boolean);
      const dForms = Array.from(
        new Set([
          item.district,
          normTaiChar(item.district),
          item.district.replace(/臺/g, '台')
        ])
      ).filter(Boolean);

      const cGroup = cForms.map(escapeRegExp).join('|');
      const dGroup = dForms.map(escapeRegExp).join('|');
      const pattern = new RegExp(`(${cGroup})\\s*(${dGroup})`);
      const match = target.match(pattern);
      if (match) {
        const remaining = target.replace(pattern, '').trim();
        const zip =
          candidate.leadZip && candidate.leadZip.startsWith(item.postalCode)
            ? candidate.leadZip
            : item.postalCode;
        return {
          postalCode: zip,
          city: item.city,
          district: item.district,
          remaining
        };
      }
    }

    // 3b. 若包含「縣市」但尚未選取或未含「行政區」（如 "台北市" 或 "630 雲林縣" 或舊縣市別名）
    for (const cityName of allCities) {
      const cMeta = cityMetaByNorm.get(normTaiChar(cityName));
      const cityForms = Array.from(
        new Set([
          cityName,
          normTaiChar(cityName),
          cityName.replace(/臺/g, '台'),
          ...(cMeta?.aliases || []).flatMap(a => [a, normTaiChar(a), a.replace(/臺/g, '台')])
        ])
      ).filter(Boolean);
      const cityPattern = new RegExp(`^(${cityForms.map(escapeRegExp).join('|')})\\s*(.*)$`);
      const match = target.match(cityPattern);
      if (match) {
        return {
          postalCode: candidate.leadZip,
          city: cityName,
          remaining: (match[2] || '').trim()
        };
      }
    }

    // 3c. 若未包含縣市，僅比對行政區名稱（同時相容 臺/台）
    for (const item of orderedCatalog) {
      const aliasDist = item.district.replace(/臺/g, '台');
      const distPattern = new RegExp(`(${escapeRegExp(item.district)}|${escapeRegExp(aliasDist)})`);
      if (distPattern.test(target)) {
        const remaining = target.replace(distPattern, '').trim();
        const zip =
          candidate.leadZip && candidate.leadZip.startsWith(item.postalCode)
            ? candidate.leadZip
            : item.postalCode;
        return {
          postalCode: zip,
          city: item.city,
          district: item.district,
          remaining
        };
      }
    }
  }

  return {};
}

/**
 * 取得全台灣所有縣市清單 (動態讀取郵局微型資料庫；預設只列現行啟用)
 */
export function getTaiwanCities(includeInactive: boolean = false): string[] {
  const pool = getPostalCatalog({ includeInactive });
  const fromDistricts = pool.map(p => p.city);
  const fromCities = getCityCatalog({ includeInactive }).map(c => c.cityName);
  return Array.from(new Set([...fromDistricts, ...fromCities]));
}

/**
 * 正規化台灣縣市名稱（優先精準對齊郵局微型資料庫現行名稱，否則將「台」轉為「臺」）
 */
export function normalizeTaiwanCity(cityName?: string): string {
  if (!cityName) return '';
  const trimmed = cityName.trim();
  const norm = normTaiChar(trimmed);
  const allCities = getTaiwanCities(true);
  const exactFound = allCities.find(c => c === trimmed);
  if (exactFound) return exactFound;
  const charEquivFound = allCities.find(c => normTaiChar(c) === norm);
  return charEquivFound || norm;
}

/**
 * 正規化台灣鄉鎮市區名稱（相容臺西鄉/台西鄉、霧臺鄉/霧台鄉、臺東市/台東市）
 */
export function normalizeTaiwanDistrict(districtName?: string): string {
  if (!districtName) return '';
  return normTaiChar(districtName);
}

/**
 * 比對地址文字或區域欄位是否符合目標縣市／鄉鎮
 * 由地址小程式統一處理：
 * 1. 「台／臺」字體差異
 * 2. 郵局微型資料庫設定的歷史沿革別名雙向互通（例如 桃園縣 ↔ 桃園市、中壢市 ↔ 中壢區）
 */
export function matchesTaiwanRegion(
  candidateText?: string,
  targetRegion?: string,
  exact: boolean = false
): boolean {
  if (!candidateText || !targetRegion) return false;
  const normCandidate = normTaiChar(candidateText);
  const normTarget = normTaiChar(targetRegion);
  if (!normCandidate || !normTarget) return false;

  const graph = getAliasGraph();
  const targetEquivalents = graph.get(normTarget) || [normTarget];

  if (exact) {
    const candidateEquivalents = graph.get(normCandidate) || [normCandidate];
    return candidateEquivalents.some(ce => targetEquivalents.includes(ce));
  }

  if (targetEquivalents.some(t => normCandidate.includes(t))) {
    return true;
  }

  // 若候選字串本身包含某舊稱或別名，展開其等價地名再比對一次
  for (const [aliasKey, equivs] of graph.entries()) {
    if (normCandidate.includes(aliasKey) && equivs.some(e => e === normTarget || targetEquivalents.includes(e))) {
      return true;
    }
  }

  return false;
}

/**
 * 根據縣市與鄉鎮市區取得對應的 3 碼郵遞區號
 */
export function getPostalCode(city: string, district: string): string | undefined {
  const districts = getDistrictsByCity(city, { includeInactive: true });
  const normDist = normalizeTaiwanDistrict(district);
  // 優先回傳現行啟用列
  const activeFound = districts.find(
    d => d.isActive !== false && (normTaiChar(d.district) === normDist || d.district === district)
  );
  if (activeFound) return activeFound.postalCode;
  const fallback = districts.find(
    d => normTaiChar(d.district) === normDist || d.district === district
  );
  return fallback?.postalCode;
}

/**
 * 根據郵遞區號（取前 3 碼）反查對應的所有縣市與鄉鎮市區清單
 */
export function getLocationsByPostalCode(
  postalCode?: string,
  options?: { includeInactive?: boolean }
): DistrictPostal[] {
  if (!postalCode) return [];
  const digits = postalCode.trim().replace(/\D/g, '');
  if (digits.length < 3) return [];
  const zip3 = digits.slice(0, 3);
  const pool = getPostalCatalog(options);
  // 現行啟用優先排前
  return pool
    .filter(p => p.postalCode === zip3)
    .sort((a, b) => Number(b.isActive !== false) - Number(a.isActive !== false));
}

/**
 * 根據郵遞區號（取前 3 碼）反查對應的第一筆縣市與鄉鎮市區
 */
export function getLocationByPostalCode(postalCode?: string): DistrictPostal | undefined {
  const list = getLocationsByPostalCode(postalCode, { includeInactive: false });
  return list[0] || getLocationsByPostalCode(postalCode, { includeInactive: true })[0];
}

/**
 * 智慧反向查找郵遞區號與縣市別名 (與 parseTaiwanAddress 同義)
 */
export function lookupPostalCode(addressText?: string): {
  postalCode?: string;
  city?: string;
  district?: string;
  remaining?: string;
} {
  return parseTaiwanAddress(addressText);
}

