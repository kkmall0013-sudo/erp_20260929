// 臺灣全國金融機構代號與機構清冊官方資料庫
// 資料來源：財金資訊股份有限公司 (FISC) 台幣跨行通匯金融機構代號表 (https://www.fisc.com.tw/tc/download/twd.txt)
// 完整收錄：本國銀行、公營/國庫機構、純網路銀行、中華郵政、全臺 23 家信用合作社、外商與票券機構、電子支付、全臺 311 家農漁會信用部（農金資訊及南農中心所屬會員）

export type BankCategory =
  | '本國銀行'
  | '純網銀'
  | '中華郵政'
  | '信用合作社'
  | '農漁會信用部'
  | '外商銀行'
  | '電支機構';

export interface BankInfo {
  code: string;         // 財金 3 碼總機構代號 (如 004, 616, 700, 822)
  branchCode?: string;  // 財金 7 碼總行/本會通匯代號 (如斗南鎮農會 6160056)
  name: string;         // 財金資訊官方機構全銜
  shortName: string;    // 財金資訊官方簡稱
  category: BankCategory;
  centerName?: string;  // 農漁會資訊中心標記 (農金資訊所屬會員 / 南農中心共用代號)
}

export const BANK_CATEGORIES: { key: 'ALL' | BankCategory; label: string }[] = [
  { key: 'ALL', label: '全部機構' },
  { key: '本國銀行', label: '本國銀行' },
  { key: '純網銀', label: '純網銀' },
  { key: '中華郵政', label: '中華郵政' },
  { key: '信用合作社', label: '信用合作社' },
  { key: '農漁會信用部', label: '農漁會信用部' },
  { key: '外商銀行', label: '外商銀行' },
  { key: '電支機構', label: '電支機構' },
];

export const TAIWAN_BANKS: BankInfo[] = [
  {
    "code": "000",
    "branchCode": "0000022",
    "name": "中央銀行國庫局",
    "shortName": "央行國庫局",
    "category": "本國銀行"
  },
  {
    "code": "004",
    "branchCode": "0040037",
    "name": "臺灣銀行",
    "shortName": "臺銀",
    "category": "本國銀行"
  },
  {
    "code": "005",
    "branchCode": "0050027",
    "name": "臺灣土地銀行",
    "shortName": "土銀",
    "category": "本國銀行"
  },
  {
    "code": "006",
    "branchCode": "0060017",
    "name": "合作金庫商業銀行",
    "shortName": "合庫商銀",
    "category": "本國銀行"
  },
  {
    "code": "007",
    "branchCode": "0070937",
    "name": "第一商業銀行",
    "shortName": "一銀",
    "category": "本國銀行"
  },
  {
    "code": "008",
    "branchCode": "0081005",
    "name": "華南商業銀行",
    "shortName": "華銀",
    "category": "本國銀行"
  },
  {
    "code": "009",
    "branchCode": "0092200",
    "name": "彰化商業銀行",
    "shortName": "彰銀",
    "category": "本國銀行"
  },
  {
    "code": "011",
    "branchCode": "0110026",
    "name": "上海商業儲蓄銀行",
    "shortName": "上銀",
    "category": "本國銀行"
  },
  {
    "code": "012",
    "branchCode": "0122009",
    "name": "台北富邦商業銀行",
    "shortName": "北富銀",
    "category": "本國銀行"
  },
  {
    "code": "013",
    "branchCode": "0130017",
    "name": "國泰世華商業銀行",
    "shortName": "國世銀",
    "category": "本國銀行"
  },
  {
    "code": "016",
    "branchCode": "0161017",
    "name": "高雄銀行",
    "shortName": "高銀",
    "category": "本國銀行"
  },
  {
    "code": "017",
    "branchCode": "0170022",
    "name": "兆豐國際商業銀行",
    "shortName": "兆豐銀",
    "category": "本國銀行"
  },
  {
    "code": "018",
    "branchCode": "0180012",
    "name": "全國農業金庫",
    "shortName": "農業金庫",
    "category": "本國銀行"
  },
  {
    "code": "020",
    "branchCode": "0200017",
    "name": "日商瑞穗銀行台北分行",
    "shortName": "瑞穗銀行",
    "category": "外商銀行"
  },
  {
    "code": "021",
    "branchCode": "0210018",
    "name": "花旗（台灣）商業銀行",
    "shortName": "花旗台灣",
    "category": "本國銀行"
  },
  {
    "code": "022",
    "branchCode": "0220019",
    "name": "美國銀行台北分行",
    "shortName": "美銀台北",
    "category": "外商銀行"
  },
  {
    "code": "023",
    "branchCode": "0230010",
    "name": "泰國盤谷銀行台北分行",
    "shortName": "盤谷台北",
    "category": "外商銀行"
  },
  {
    "code": "025",
    "branchCode": "0250012",
    "name": "菲律賓首都銀行台北分行",
    "shortName": "首都台北",
    "category": "外商銀行"
  },
  {
    "code": "029",
    "branchCode": "0290005",
    "name": "新加坡商大華銀行台北分行",
    "shortName": "大華銀台北",
    "category": "外商銀行"
  },
  {
    "code": "030",
    "branchCode": "0300010",
    "name": "美商道富銀行台北分行",
    "shortName": "道富銀行",
    "category": "外商銀行"
  },
  {
    "code": "037",
    "branchCode": "0370017",
    "name": "法商法國興業銀行台北分行",
    "shortName": "法興台北",
    "category": "外商銀行"
  },
  {
    "code": "039",
    "branchCode": "0390019",
    "name": "澳商澳盛銀行台北分行",
    "shortName": "澳盛銀行",
    "category": "外商銀行"
  },
  {
    "code": "048",
    "branchCode": "0480011",
    "name": "王道商業銀行",
    "shortName": "王道銀行",
    "category": "本國銀行"
  },
  {
    "code": "050",
    "branchCode": "0500027",
    "name": "臺灣中小企業銀行",
    "shortName": "臺企",
    "category": "本國銀行"
  },
  {
    "code": "052",
    "branchCode": "0520041",
    "name": "渣打國際商業銀行",
    "shortName": "渣商銀",
    "category": "本國銀行"
  },
  {
    "code": "053",
    "branchCode": "0530019",
    "name": "台中商業銀行",
    "shortName": "台中銀",
    "category": "本國銀行"
  },
  {
    "code": "054",
    "branchCode": "0540010",
    "name": "京城商業銀行",
    "shortName": "京城銀行",
    "category": "本國銀行"
  },
  {
    "code": "060",
    "branchCode": "0600019",
    "name": "兆豐票券金融股份有限公司",
    "shortName": "兆豐票券",
    "category": "外商銀行"
  },
  {
    "code": "061",
    "branchCode": "0610010",
    "name": "中華票券金融股份有限公司",
    "shortName": "華票",
    "category": "外商銀行"
  },
  {
    "code": "062",
    "branchCode": "0620011",
    "name": "國際票券金融股份有限公司",
    "shortName": "國票",
    "category": "外商銀行"
  },
  {
    "code": "066",
    "branchCode": "0660015",
    "name": "萬通票券金融股份有限公司",
    "shortName": "萬票",
    "category": "外商銀行"
  },
  {
    "code": "072",
    "branchCode": "0720014",
    "name": "德商德意志銀行台北分行",
    "shortName": "德銀台北",
    "category": "外商銀行"
  },
  {
    "code": "075",
    "branchCode": "0750006",
    "name": "香港商東亞銀行台北分行",
    "shortName": "東亞銀行",
    "category": "外商銀行"
  },
  {
    "code": "076",
    "branchCode": "0760018",
    "name": "美商摩根大通銀行台北分行",
    "shortName": "摩根大通銀",
    "category": "外商銀行"
  },
  {
    "code": "081",
    "branchCode": "0810016",
    "name": "匯豐（台灣）商業銀行",
    "shortName": "匯豐台灣",
    "category": "本國銀行"
  },
  {
    "code": "082",
    "branchCode": "0820017",
    "name": "法國巴黎銀行台北分行",
    "shortName": "巴黎銀行",
    "category": "外商銀行"
  },
  {
    "code": "085",
    "branchCode": "0850009",
    "name": "新加坡商新加坡華僑銀行台北分行",
    "shortName": "新僑銀行",
    "category": "外商銀行"
  },
  {
    "code": "086",
    "branchCode": "0860011",
    "name": "法商東方匯理銀行台北分行",
    "shortName": "東方匯理",
    "category": "外商銀行"
  },
  {
    "code": "092",
    "branchCode": "0920010",
    "name": "瑞士商瑞士銀行台北分行",
    "shortName": "瑞士銀行",
    "category": "外商銀行"
  },
  {
    "code": "093",
    "branchCode": "0930011",
    "name": "荷商安智銀行台北分行",
    "shortName": "安智銀行",
    "category": "外商銀行"
  },
  {
    "code": "098",
    "branchCode": "0980016",
    "name": "日商三菱日聯銀行台北分行",
    "shortName": "三菱日聯",
    "category": "外商銀行"
  },
  {
    "code": "101",
    "branchCode": "1010011",
    "name": "瑞興商業銀行",
    "shortName": "瑞興銀行",
    "category": "本國銀行"
  },
  {
    "code": "102",
    "branchCode": "1020010",
    "name": "華泰商業銀行",
    "shortName": "華泰銀行",
    "category": "本國銀行"
  },
  {
    "code": "103",
    "branchCode": "1030019",
    "name": "臺灣新光商業銀行",
    "shortName": "新光銀行",
    "category": "本國銀行"
  },
  {
    "code": "104",
    "branchCode": "1040018",
    "name": "台北市第五信用合作社",
    "shortName": "北五",
    "category": "信用合作社"
  },
  {
    "code": "108",
    "branchCode": "1080014",
    "name": "陽信商業銀行",
    "shortName": "陽信銀行",
    "category": "本國銀行"
  },
  {
    "code": "114",
    "branchCode": "1140015",
    "name": "基隆第一信用合作社",
    "shortName": "基一",
    "category": "信用合作社"
  },
  {
    "code": "115",
    "branchCode": "1150014",
    "name": "基隆市第二信用合作社",
    "shortName": "基二",
    "category": "信用合作社"
  },
  {
    "code": "118",
    "branchCode": "1180011",
    "name": "板信商業銀行",
    "shortName": "板信銀行",
    "category": "本國銀行"
  },
  {
    "code": "119",
    "branchCode": "1190010",
    "name": "淡水第一信用合作社",
    "shortName": "淡一",
    "category": "信用合作社"
  },
  {
    "code": "120",
    "branchCode": "1200016",
    "name": "新北市淡水信用合作社",
    "shortName": "淡信",
    "category": "信用合作社"
  },
  {
    "code": "124",
    "branchCode": "1240012",
    "name": "宜蘭信用合作社",
    "shortName": "宜信",
    "category": "信用合作社"
  },
  {
    "code": "127",
    "branchCode": "1270019",
    "name": "桃園信用合作社",
    "shortName": "桃信",
    "category": "信用合作社"
  },
  {
    "code": "130",
    "branchCode": "1300013",
    "name": "新竹第一信用合作社",
    "shortName": "竹一",
    "category": "信用合作社"
  },
  {
    "code": "132",
    "branchCode": "1320011",
    "name": "新竹第三信用合作社",
    "shortName": "竹三",
    "category": "信用合作社"
  },
  {
    "code": "146",
    "branchCode": "1460014",
    "name": "台中市第二信用合作社",
    "shortName": "中二",
    "category": "信用合作社"
  },
  {
    "code": "147",
    "branchCode": "1470013",
    "name": "三信商業銀行",
    "shortName": "三信銀行",
    "category": "本國銀行"
  },
  {
    "code": "158",
    "branchCode": "1580019",
    "name": "彰化第一信用合作社",
    "shortName": "彰一",
    "category": "信用合作社"
  },
  {
    "code": "161",
    "branchCode": "1610013",
    "name": "彰化第五信用合作社",
    "shortName": "彰五",
    "category": "信用合作社"
  },
  {
    "code": "162",
    "branchCode": "1620012",
    "name": "彰化第六信用合作社",
    "shortName": "彰六",
    "category": "信用合作社"
  },
  {
    "code": "163",
    "branchCode": "1630011",
    "name": "彰化第十信用合作社",
    "shortName": "彰十",
    "category": "信用合作社"
  },
  {
    "code": "165",
    "branchCode": "1650019",
    "name": "彰化縣鹿港信用合作社",
    "shortName": "鹿信",
    "category": "信用合作社"
  },
  {
    "code": "178",
    "branchCode": "1780013",
    "name": "嘉義市第三信用合作社",
    "shortName": "嘉三",
    "category": "信用合作社"
  },
  {
    "code": "188",
    "branchCode": "1880010",
    "name": "台南第三信用合作社",
    "shortName": "南三",
    "category": "信用合作社"
  },
  {
    "code": "204",
    "branchCode": "2040011",
    "name": "高雄市第三信用合作社",
    "shortName": "高三",
    "category": "信用合作社"
  },
  {
    "code": "215",
    "branchCode": "2150017",
    "name": "花蓮第一信用合作社",
    "shortName": "花一",
    "category": "信用合作社"
  },
  {
    "code": "216",
    "branchCode": "2160016",
    "name": "花蓮第二信用合作社",
    "shortName": "花二",
    "category": "信用合作社"
  },
  {
    "code": "222",
    "branchCode": "2220017",
    "name": "澎湖縣第一信用合作社",
    "shortName": "澎一",
    "category": "信用合作社"
  },
  {
    "code": "223",
    "branchCode": "2230016",
    "name": "澎湖第二信用合作社",
    "shortName": "澎二",
    "category": "信用合作社"
  },
  {
    "code": "224",
    "branchCode": "2240015",
    "name": "金門縣信用合作社",
    "shortName": "金門",
    "category": "信用合作社"
  },
  {
    "code": "321",
    "branchCode": "3210019",
    "name": "日商三井住友銀行台北分行",
    "shortName": "三井住友",
    "category": "外商銀行"
  },
  {
    "code": "326",
    "branchCode": "3268881",
    "name": "西班牙商西班牙對外銀行臺北分行",
    "shortName": "西班牙對外",
    "category": "外商銀行"
  },
  {
    "code": "329",
    "branchCode": "3290017",
    "name": "印尼商印尼人民銀行台北分行",
    "shortName": "印尼人民銀",
    "category": "外商銀行"
  },
  {
    "code": "330",
    "branchCode": "3300011",
    "name": "韓商韓亞銀行台北分行",
    "shortName": "韓亞銀台北",
    "category": "外商銀行"
  },
  {
    "code": "372",
    "branchCode": "3720015",
    "name": "大慶票券金融股份有限公司",
    "shortName": "大慶票券",
    "category": "外商銀行"
  },
  {
    "code": "380",
    "branchCode": "3800016",
    "name": "大陸商中國銀行臺北分行",
    "shortName": "中銀臺北",
    "category": "外商銀行"
  },
  {
    "code": "381",
    "branchCode": "3810888",
    "name": "大陸商交通銀行臺北分行",
    "shortName": "交銀臺北",
    "category": "外商銀行"
  },
  {
    "code": "382",
    "branchCode": "3820018",
    "name": "大陸商中國建設銀行臺北分行",
    "shortName": "建行臺北",
    "category": "外商銀行"
  },
  {
    "code": "388",
    "name": "全盈支付金融科技股份有限公司",
    "shortName": "全盈+PAY",
    "category": "電支機構"
  },
  {
    "code": "389",
    "name": "全支付電子支付股份有限公司",
    "shortName": "全支付",
    "category": "電支機構"
  },
  {
    "code": "390",
    "name": "悠遊卡股份有限公司",
    "shortName": "悠遊付",
    "category": "電支機構"
  },
  {
    "code": "391",
    "name": "一卡通票證股份有限公司",
    "shortName": "iPASS MONEY",
    "category": "電支機構"
  },
  {
    "code": "392",
    "name": "愛金卡股份有限公司",
    "shortName": "icash Pay",
    "category": "電支機構"
  },
  {
    "code": "395",
    "name": "橘子支行動支付股份有限公司",
    "shortName": "橘子支付",
    "category": "電支機構"
  },
  {
    "code": "396",
    "name": "街口電子支付股份有限公司",
    "shortName": "街口支付",
    "category": "電支機構"
  },
  {
    "code": "397",
    "name": "歐付寶電子支付股份有限公司",
    "shortName": "歐付寶",
    "category": "電支機構"
  },
  {
    "code": "398",
    "name": "簡單行動支付股份有限公司",
    "shortName": "ezPay簡單付",
    "category": "電支機構"
  },
  {
    "code": "501",
    "branchCode": "5010017",
    "name": "宜蘭縣蘇澳區漁會",
    "shortName": "蘇澳漁會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "502",
    "branchCode": "5020018",
    "name": "宜蘭縣頭城區漁會",
    "shortName": "頭城漁會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "506",
    "branchCode": "5060012",
    "name": "桃園區漁會",
    "shortName": "桃園區漁會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "507",
    "branchCode": "5070013",
    "name": "新竹區漁會",
    "shortName": "新竹區漁會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "508",
    "branchCode": "5080014",
    "name": "通苑區漁會",
    "shortName": "通苑漁會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "510",
    "branchCode": "5100019",
    "name": "南龍區漁會",
    "shortName": "南龍漁會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "511",
    "branchCode": "5110010",
    "name": "彰化區漁會",
    "shortName": "彰化漁會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "512",
    "branchCode": "5120011",
    "name": "雲林區漁會",
    "shortName": "雲林漁",
    "category": "農漁會信用部",
    "centerName": "南農中心所屬會員"
  },
  {
    "code": "513",
    "branchCode": "5130012",
    "name": "新北市瑞芳區漁會",
    "shortName": "瑞芳漁會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "514",
    "branchCode": "5140013",
    "name": "萬里區漁會",
    "shortName": "萬里區漁會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "515",
    "branchCode": "5150014",
    "name": "嘉義區漁會",
    "shortName": "嘉義漁",
    "category": "農漁會信用部",
    "centerName": "南農中心所屬會員"
  },
  {
    "code": "516",
    "branchCode": "5160015",
    "name": "基隆區漁會",
    "shortName": "基隆漁會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "517",
    "branchCode": "5170016",
    "name": "南市區漁會",
    "shortName": "南市漁",
    "category": "農漁會信用部",
    "centerName": "南農中心所屬會員"
  },
  {
    "code": "518",
    "branchCode": "5180017",
    "name": "南縣區漁會",
    "shortName": "南縣漁",
    "category": "農漁會信用部",
    "centerName": "南農中心所屬會員"
  },
  {
    "code": "519",
    "branchCode": "5190018",
    "name": "新化區農會",
    "shortName": "新化農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "520",
    "branchCode": "5200012",
    "name": "高雄區漁會",
    "shortName": "高漁會信用",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (520)"
  },
  {
    "code": "520",
    "branchCode": "5200023",
    "name": "小港區漁會",
    "shortName": "港漁信用",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (520)"
  },
  {
    "code": "521",
    "branchCode": "5210024",
    "name": "興達港區漁會",
    "shortName": "興達漁",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (521)"
  },
  {
    "code": "521",
    "branchCode": "5210068",
    "name": "林園區漁會",
    "shortName": "林漁",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (521)"
  },
  {
    "code": "521",
    "branchCode": "5210079",
    "name": "彌陀區漁會",
    "shortName": "彌漁",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (521)"
  },
  {
    "code": "521",
    "branchCode": "5210091",
    "name": "永安區漁會",
    "shortName": "永漁",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (521)"
  },
  {
    "code": "521",
    "branchCode": "5210116",
    "name": "梓官區漁會",
    "shortName": "梓官漁",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (521)"
  },
  {
    "code": "523",
    "branchCode": "5230015",
    "name": "琉球區漁會",
    "shortName": "琉漁",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (523)"
  },
  {
    "code": "523",
    "branchCode": "5230037",
    "name": "東港區漁會",
    "shortName": "東漁",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (523)"
  },
  {
    "code": "523",
    "branchCode": "5230048",
    "name": "林邊區漁會",
    "shortName": "林邊漁",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (523)"
  },
  {
    "code": "523",
    "branchCode": "5230130",
    "name": "枋寮區漁會",
    "shortName": "枋寮漁",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (523)"
  },
  {
    "code": "524",
    "branchCode": "5240016",
    "name": "新港區漁會",
    "shortName": "新漁",
    "category": "農漁會信用部",
    "centerName": "南農中心所屬會員"
  },
  {
    "code": "525",
    "branchCode": "5250017",
    "name": "澎湖區漁會",
    "shortName": "澎湖漁",
    "category": "農漁會信用部",
    "centerName": "南農中心所屬會員"
  },
  {
    "code": "526",
    "branchCode": "5260018",
    "name": "金門區漁會",
    "shortName": "金門漁",
    "category": "農漁會信用部",
    "centerName": "南農中心所屬會員"
  },
  {
    "code": "538",
    "branchCode": "5380013",
    "name": "宜蘭市農會",
    "shortName": "宜蘭農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "541",
    "branchCode": "5410019",
    "name": "白河區農會",
    "shortName": "白河農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "542",
    "branchCode": "5420010",
    "name": "麻豆區農會",
    "shortName": "麻豆農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "547",
    "branchCode": "5470015",
    "name": "後壁區農會",
    "shortName": "後壁農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "549",
    "branchCode": "5490017",
    "name": "下營區農會",
    "shortName": "下營農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "551",
    "branchCode": "5510012",
    "name": "官田區農會",
    "shortName": "官田農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "552",
    "branchCode": "5520013",
    "name": "大內區農會",
    "shortName": "大內農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "556",
    "branchCode": "5560017",
    "name": "學甲區農會",
    "shortName": "學甲農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "557",
    "branchCode": "5570018",
    "name": "新市區農會",
    "shortName": "新市農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "558",
    "branchCode": "5580019",
    "name": "安定區農會",
    "shortName": "安定農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "559",
    "branchCode": "5590010",
    "name": "山上區農會",
    "shortName": "山上農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "561",
    "branchCode": "5610015",
    "name": "左鎮區農會",
    "shortName": "左鎮農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "562",
    "branchCode": "5620016",
    "name": "仁德區農會",
    "shortName": "仁德農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "564",
    "branchCode": "5640018",
    "name": "關廟區農會",
    "shortName": "關廟農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "565",
    "branchCode": "5650019",
    "name": "龍崎區農會",
    "shortName": "龍崎農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "567",
    "branchCode": "5670011",
    "name": "南化區農會",
    "shortName": "南化農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "568",
    "branchCode": "5680012",
    "name": "七股區農會",
    "shortName": "七股農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "570",
    "branchCode": "5700017",
    "name": "南投市農會",
    "shortName": "南投農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "573",
    "branchCode": "5730010",
    "name": "埔里鎮農會",
    "shortName": "埔里農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "574",
    "branchCode": "5740011",
    "name": "竹山鎮農會",
    "shortName": "竹山農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "575",
    "branchCode": "5750012",
    "name": "中寮鄉農會",
    "shortName": "中寮農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "577",
    "branchCode": "5770014",
    "name": "魚池鄉農會",
    "shortName": "魚池農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "578",
    "branchCode": "5780015",
    "name": "水里鄉農會",
    "shortName": "水里農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "579",
    "branchCode": "5790016",
    "name": "國姓鄉農會",
    "shortName": "國姓農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "580",
    "branchCode": "5800010",
    "name": "鹿谷鄉農會",
    "shortName": "鹿谷農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "581",
    "branchCode": "5810011",
    "name": "信義鄉農會",
    "shortName": "信義農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "582",
    "branchCode": "5820012",
    "name": "仁愛鄉農會",
    "shortName": "仁愛農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "583",
    "branchCode": "5830013",
    "name": "東山區農會",
    "shortName": "東山農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "585",
    "branchCode": "5850015",
    "name": "頭城鎮農會",
    "shortName": "頭城農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "586",
    "branchCode": "5860016",
    "name": "羅東鎮農會",
    "shortName": "羅東農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "587",
    "branchCode": "5870017",
    "name": "礁溪鄉農會",
    "shortName": "礁溪農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "588",
    "branchCode": "5880018",
    "name": "壯圍鄉農會",
    "shortName": "壯圍農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "589",
    "branchCode": "5890019",
    "name": "員山鄉農會",
    "shortName": "員山農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "596",
    "branchCode": "5960019",
    "name": "五結鄉農會",
    "shortName": "五結農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "598",
    "branchCode": "5980011",
    "name": "蘇澳地區農會",
    "shortName": "蘇澳農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "599",
    "branchCode": "5990012",
    "name": "三星地區農會",
    "shortName": "三星農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "600",
    "name": "農金資訊股份有限公司 (農漁會共用中心)",
    "shortName": "農金資訊",
    "category": "農漁會信用部"
  },
  {
    "code": "602",
    "branchCode": "6020015",
    "name": "中華民國農會中壢辦事處信用部",
    "shortName": "中華民國農",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "605",
    "branchCode": "6050018",
    "name": "高雄市高雄地區農會",
    "shortName": "高區農",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "612",
    "branchCode": "6121107",
    "name": "臺中市豐原區農會",
    "shortName": "豐原農會",
    "category": "農漁會信用部",
    "centerName": "南農中心所屬會員"
  },
  {
    "code": "613",
    "branchCode": "6130031",
    "name": "集集鎮農會",
    "shortName": "集集",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (613)"
  },
  {
    "code": "613",
    "branchCode": "6130075",
    "name": "名間鄉農會",
    "shortName": "名間",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (613)"
  },
  {
    "code": "614",
    "branchCode": "6140043",
    "name": "員林市農會",
    "shortName": "員林",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (614)"
  },
  {
    "code": "614",
    "branchCode": "6140087",
    "name": "二林鎮農會",
    "shortName": "二林農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (614)"
  },
  {
    "code": "614",
    "branchCode": "6140124",
    "name": "秀水鄉農會",
    "shortName": "秀水",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (614)"
  },
  {
    "code": "614",
    "branchCode": "6140179",
    "name": "埔心鄉農會",
    "shortName": "埔心",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (614)"
  },
  {
    "code": "614",
    "branchCode": "6140180",
    "name": "永靖鄉農會",
    "shortName": "永靖",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (614)"
  },
  {
    "code": "614",
    "branchCode": "6140227",
    "name": "埤頭鄉農會",
    "shortName": "埤頭",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (614)"
  },
  {
    "code": "614",
    "branchCode": "6140261",
    "name": "竹塘鄉農會",
    "shortName": "竹塘",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (614)"
  },
  {
    "code": "614",
    "branchCode": "6141327",
    "name": "芬園鄉農會",
    "shortName": "芬園農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (614)"
  },
  {
    "code": "614",
    "branchCode": "6141338",
    "name": "芳苑鄉農會",
    "shortName": "芳苑農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (614)"
  },
  {
    "code": "615",
    "branchCode": "6150011",
    "name": "基隆市農會",
    "shortName": "基隆農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "616",
    "branchCode": "6160012",
    "name": "斗六市農會",
    "shortName": "斗六",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "616",
    "branchCode": "6160023",
    "name": "虎尾鎮農會",
    "shortName": "虎尾農",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "616",
    "branchCode": "6160034",
    "name": "西螺鎮農會",
    "shortName": "西螺",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "616",
    "branchCode": "6160056",
    "name": "斗南鎮農會",
    "shortName": "斗南鎮農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "616",
    "branchCode": "6160078",
    "name": "古坑鄉農會",
    "shortName": "古坑",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "616",
    "branchCode": "6160089",
    "name": "大埤鄉農會",
    "shortName": "大埤",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "616",
    "branchCode": "6160090",
    "name": "莿桐鄉農會",
    "shortName": "莿桐",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "616",
    "branchCode": "6160115",
    "name": "二崙鄉農會",
    "shortName": "二崙",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "616",
    "branchCode": "6160126",
    "name": "崙背鄉農會",
    "shortName": "崙背",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "616",
    "branchCode": "6160137",
    "name": "台西鄉農會",
    "shortName": "台西",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "616",
    "branchCode": "6160148",
    "name": "褒忠鄉農會",
    "shortName": "褒忠",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "616",
    "branchCode": "6160160",
    "name": "四湖鄉農會",
    "shortName": "四湖",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "616",
    "branchCode": "6160171",
    "name": "口湖鄉農會",
    "shortName": "口湖",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (616)"
  },
  {
    "code": "617",
    "branchCode": "6170024",
    "name": "朴子市農會",
    "shortName": "朴子",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170035",
    "name": "布袋鎮農會",
    "shortName": "布袋",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170046",
    "name": "大林鎮農會",
    "shortName": "大林",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170057",
    "name": "民雄鄉農會",
    "shortName": "民雄",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170068",
    "name": "溪口鄉農會",
    "shortName": "溪口",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170079",
    "name": "東石鄉農會",
    "shortName": "東石農",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170080",
    "name": "義竹鄉農會",
    "shortName": "義竹",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170091",
    "name": "鹿草鄉農會",
    "shortName": "鹿草",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170105",
    "name": "太保市農會",
    "shortName": "太保",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170116",
    "name": "水上鄉農會",
    "shortName": "水上",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170138",
    "name": "番路鄉農會",
    "shortName": "番路",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170149",
    "name": "竹崎地區農會",
    "shortName": "竹崎",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170150",
    "name": "梅山鄉農會",
    "shortName": "梅山",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170806",
    "name": "六腳鄉農會",
    "shortName": "六腳",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170817",
    "name": "新港鄉農會",
    "shortName": "新港",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "617",
    "branchCode": "6170862",
    "name": "嘉義市農會",
    "shortName": "嘉市",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (617)"
  },
  {
    "code": "618",
    "branchCode": "6180025",
    "name": "新營區農會",
    "shortName": "新營",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "618",
    "branchCode": "6180036",
    "name": "鹽水區農會",
    "shortName": "鹽水",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "618",
    "branchCode": "6180069",
    "name": "佳里區農會",
    "shortName": "佳里",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "618",
    "branchCode": "6180081",
    "name": "善化區農會",
    "shortName": "善化",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "618",
    "branchCode": "6180092",
    "name": "柳營區農會",
    "shortName": "柳營",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "618",
    "branchCode": "6180139",
    "name": "六甲區農會",
    "shortName": "六甲",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "618",
    "branchCode": "6180162",
    "name": "西港區農會",
    "shortName": "西港",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "618",
    "branchCode": "6180184",
    "name": "將軍區農會",
    "shortName": "將軍",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "618",
    "branchCode": "6180195",
    "name": "北門區農會",
    "shortName": "北門",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "618",
    "branchCode": "6180243",
    "name": "臺南市玉井區農會",
    "shortName": "玉井農",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "618",
    "branchCode": "6180298",
    "name": "歸仁區農會",
    "shortName": "歸仁農",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "618",
    "branchCode": "6180324",
    "name": "永康區農會",
    "shortName": "永康",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "618",
    "branchCode": "6181402",
    "name": "楠西區農會",
    "shortName": "楠西農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (618)"
  },
  {
    "code": "619",
    "branchCode": "6190015",
    "name": "鳳山區農會",
    "shortName": "鳳農",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190026",
    "name": "岡山區農會",
    "shortName": "岡山",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190037",
    "name": "旗山區農會",
    "shortName": "旗農",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190048",
    "name": "美濃區農會",
    "shortName": "美濃農",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190059",
    "name": "橋頭區農會",
    "shortName": "橋頭",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190060",
    "name": "燕巢區農會",
    "shortName": "燕巢",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190071",
    "name": "田寮區農會",
    "shortName": "田寮",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190082",
    "name": "阿蓮區農會",
    "shortName": "阿蓮",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190093",
    "name": "路竹區農會",
    "shortName": "路竹",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190107",
    "name": "湖內區農會",
    "shortName": "湖內",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190118",
    "name": "茄萣區農會",
    "shortName": "茄萣",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190129",
    "name": "彌陀區農會",
    "shortName": "彌陀",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190130",
    "name": "永安區農會",
    "shortName": "永安",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190141",
    "name": "梓官區農會",
    "shortName": "梓官",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190185",
    "name": "林園區農會",
    "shortName": "林園",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190196",
    "name": "大寮區農會",
    "shortName": "大寮",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190211",
    "name": "仁武區農會",
    "shortName": "仁武",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190222",
    "name": "大社區農會",
    "shortName": "大社",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190244",
    "name": "杉林區農會",
    "shortName": "杉林",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190255",
    "name": "甲仙地區農會",
    "shortName": "甲仙",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6190303",
    "name": "六龜區農會",
    "shortName": "六龜農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6191089",
    "name": "鳥松區農會",
    "shortName": "鳥松",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6191104",
    "name": "大樹區農會",
    "shortName": "大樹",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "619",
    "branchCode": "6191115",
    "name": "內門區農會",
    "shortName": "內門農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (619)"
  },
  {
    "code": "620",
    "branchCode": "6200031",
    "name": "東港鎮農會",
    "shortName": "東港農信",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200042",
    "name": "恆春鎮農會",
    "shortName": "恆春",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200075",
    "name": "麟洛鄉農會",
    "shortName": "麟洛",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200086",
    "name": "九如鄉農會",
    "shortName": "九如農信",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200112",
    "name": "里港鄉農會",
    "shortName": "里港",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200167",
    "name": "崁頂鄉農會",
    "shortName": "崁頂農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200189",
    "name": "南州地區農會",
    "shortName": "南州",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200204",
    "name": "琉球鄉農會",
    "shortName": "琉球農",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200215",
    "name": "滿州鄉農會",
    "shortName": "滿州",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200259",
    "name": "枋山地區農會",
    "shortName": "枋山農",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200868",
    "name": "屏東市農會",
    "shortName": "屏市農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200879",
    "name": "車城地區農會",
    "shortName": "車城農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200880",
    "name": "屏東縣農會",
    "shortName": "屏東縣農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200891",
    "name": "枋寮地區農會",
    "shortName": "枋寮農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200905",
    "name": "竹田鄉農會",
    "shortName": "竹田農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200916",
    "name": "萬丹鄉農會",
    "shortName": "萬丹農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200927",
    "name": "長治鄉農會",
    "shortName": "長治農會",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200938",
    "name": "林邊鄉農會",
    "shortName": "林邊",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200949",
    "name": "佳冬鄉農會",
    "shortName": "佳冬",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200961",
    "name": "高樹鄉農會",
    "shortName": "高樹",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200972",
    "name": "萬巒地區農會",
    "shortName": "萬巒",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200983",
    "name": "潮州鎮農會",
    "shortName": "潮州農",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "620",
    "branchCode": "6200994",
    "name": "新園鄉農會",
    "shortName": "新園",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (620)"
  },
  {
    "code": "621",
    "branchCode": "6210021",
    "name": "吉安鄉農會",
    "shortName": "吉安",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (621)"
  },
  {
    "code": "621",
    "branchCode": "6210032",
    "name": "壽豐鄉農會",
    "shortName": "壽豐",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (621)"
  },
  {
    "code": "621",
    "branchCode": "6210043",
    "name": "富里鄉農會",
    "shortName": "富里",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (621)"
  },
  {
    "code": "621",
    "branchCode": "6210098",
    "name": "新秀地區農會",
    "shortName": "新秀",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (621)"
  },
  {
    "code": "622",
    "branchCode": "6220011",
    "name": "關山鎮農會",
    "shortName": "關山",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (622)"
  },
  {
    "code": "622",
    "branchCode": "6220022",
    "name": "成功鎮農會",
    "shortName": "成功",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (622)"
  },
  {
    "code": "622",
    "branchCode": "6220033",
    "name": "池上鄉農會",
    "shortName": "池上",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (622)"
  },
  {
    "code": "622",
    "branchCode": "6220055",
    "name": "長濱鄉農會",
    "shortName": "長濱",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (622)"
  },
  {
    "code": "622",
    "branchCode": "6220066",
    "name": "台東地區農會",
    "shortName": "台東",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (622)"
  },
  {
    "code": "622",
    "branchCode": "6220077",
    "name": "鹿野地區農會",
    "shortName": "鹿野",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (622)"
  },
  {
    "code": "622",
    "branchCode": "6220088",
    "name": "太麻里地區農會",
    "shortName": "太麻里",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (622)"
  },
  {
    "code": "622",
    "branchCode": "6220103",
    "name": "東河鄉農會",
    "shortName": "東河",
    "category": "農漁會信用部",
    "centerName": "南農中心共用代號 (622)"
  },
  {
    "code": "624",
    "branchCode": "6240013",
    "name": "澎湖縣農會",
    "shortName": "澎農信",
    "category": "農漁會信用部",
    "centerName": "南農中心所屬會員"
  },
  {
    "code": "625",
    "branchCode": "6250014",
    "name": "臺中市臺中地區農會",
    "shortName": "中區農",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "627",
    "branchCode": "6270016",
    "name": "連江縣農會",
    "shortName": "連江縣農會",
    "category": "農漁會信用部",
    "centerName": "南農中心所屬會員"
  },
  {
    "code": "628",
    "branchCode": "6280017",
    "name": "鹿港鎮農會",
    "shortName": "鹿港農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "629",
    "branchCode": "6290018",
    "name": "和美鎮農會",
    "shortName": "和美農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "631",
    "branchCode": "6310013",
    "name": "溪湖鎮農會",
    "shortName": "溪湖農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "632",
    "branchCode": "6320014",
    "name": "田中鎮農會",
    "shortName": "田中農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "633",
    "branchCode": "6330015",
    "name": "北斗鎮農會",
    "shortName": "北斗農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "635",
    "branchCode": "6350017",
    "name": "線西鄉農會",
    "shortName": "線西農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "636",
    "branchCode": "6360018",
    "name": "伸港鄉農會",
    "shortName": "伸港農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "638",
    "branchCode": "6380010",
    "name": "花壇鄉農會",
    "shortName": "花壇農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "639",
    "branchCode": "6390011",
    "name": "大村鄉農會",
    "shortName": "大村農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "642",
    "branchCode": "6420017",
    "name": "社頭鄉農會",
    "shortName": "社頭農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "643",
    "branchCode": "6430018",
    "name": "二水鄉農會",
    "shortName": "二水農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "646",
    "branchCode": "6460011",
    "name": "大城鄉農會",
    "shortName": "大城農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "647",
    "branchCode": "6470012",
    "name": "溪州鄉農會",
    "shortName": "溪州農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "649",
    "branchCode": "6490014",
    "name": "埔鹽鄉農會",
    "shortName": "埔鹽農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "650",
    "branchCode": "6500018",
    "name": "福興鄉農會",
    "shortName": "福興農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "651",
    "branchCode": "6510019",
    "name": "彰化市農會",
    "shortName": "彰化農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "683",
    "branchCode": "6830010",
    "name": "北港鎮農會",
    "shortName": "北港農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "685",
    "branchCode": "6850012",
    "name": "土庫鎮農會",
    "shortName": "土庫農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "693",
    "branchCode": "6930013",
    "name": "東勢鄉農會",
    "shortName": "東勢鄉農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "696",
    "branchCode": "6960016",
    "name": "水林鄉農會",
    "shortName": "水林農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "697",
    "branchCode": "6970017",
    "name": "元長鄉農會",
    "shortName": "元長農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "698",
    "branchCode": "6980018",
    "name": "麥寮鄉農會",
    "shortName": "麥寮農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "699",
    "branchCode": "6990019",
    "name": "林內鄉農會",
    "shortName": "林內農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "700",
    "branchCode": "7000010",
    "name": "中華郵政股份有限公司",
    "shortName": "中華郵政",
    "category": "中華郵政"
  },
  {
    "code": "749",
    "branchCode": "7490011",
    "name": "內埔地區農會",
    "shortName": "內埔農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "762",
    "branchCode": "7620010",
    "name": "大溪區農會",
    "shortName": "大溪區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "763",
    "branchCode": "7630011",
    "name": "桃園區農會",
    "shortName": "桃園區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "764",
    "branchCode": "7640012",
    "name": "平鎮區農會",
    "shortName": "平鎮區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "765",
    "branchCode": "7650013",
    "name": "楊梅區農會",
    "shortName": "楊梅區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "766",
    "branchCode": "7660014",
    "name": "大園區農會",
    "shortName": "大園區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "767",
    "branchCode": "7670015",
    "name": "蘆竹區農會",
    "shortName": "蘆竹區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "768",
    "branchCode": "7680016",
    "name": "龜山區農會",
    "shortName": "龜山區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "769",
    "branchCode": "7690017",
    "name": "八德區農會",
    "shortName": "八德區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "770",
    "branchCode": "7700011",
    "name": "新屋區農會",
    "shortName": "新屋區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "771",
    "branchCode": "7710012",
    "name": "龍潭區農會",
    "shortName": "龍潭區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "772",
    "branchCode": "7720013",
    "name": "復興區農會",
    "shortName": "復興區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "773",
    "branchCode": "7730014",
    "name": "觀音區農會",
    "shortName": "觀音區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "775",
    "branchCode": "7750016",
    "name": "土城區農會",
    "shortName": "土城農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "776",
    "branchCode": "7760017",
    "name": "三重區農會",
    "shortName": "三重農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "777",
    "branchCode": "7770018",
    "name": "中和地區農會",
    "shortName": "中和農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "778",
    "branchCode": "7780019",
    "name": "淡水區農會",
    "shortName": "淡水農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "779",
    "branchCode": "7790010",
    "name": "樹林區農會",
    "shortName": "樹林農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "780",
    "branchCode": "7800014",
    "name": "鶯歌區農會",
    "shortName": "鶯歌農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "781",
    "branchCode": "7810015",
    "name": "三峽區農會",
    "shortName": "三峽農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "785",
    "branchCode": "7850019",
    "name": "蘆洲區農會",
    "shortName": "蘆洲農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "786",
    "branchCode": "7860010",
    "name": "五股區農會",
    "shortName": "五股農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "787",
    "branchCode": "7870011",
    "name": "林口區農會",
    "shortName": "林口農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "788",
    "branchCode": "7880012",
    "name": "泰山區農會",
    "shortName": "泰山農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "789",
    "branchCode": "7890013",
    "name": "坪林區農會",
    "shortName": "坪林農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "790",
    "branchCode": "7900017",
    "name": "八里區農會",
    "shortName": "八里農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "791",
    "branchCode": "7910018",
    "name": "金山地區農會",
    "shortName": "金山農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "792",
    "branchCode": "7920019",
    "name": "瑞芳地區農會",
    "shortName": "瑞芳農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "793",
    "branchCode": "7930010",
    "name": "新店地區農會",
    "shortName": "新店農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "795",
    "branchCode": "7950012",
    "name": "深坑區農會",
    "shortName": "深坑農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "796",
    "branchCode": "7960013",
    "name": "石碇區農會",
    "shortName": "石碇農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "797",
    "branchCode": "7970014",
    "name": "平溪區農會",
    "shortName": "平溪農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "798",
    "branchCode": "7980015",
    "name": "石門區農會",
    "shortName": "石門農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "799",
    "branchCode": "7990016",
    "name": "三芝區農會",
    "shortName": "三芝農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "803",
    "branchCode": "8030010",
    "name": "聯邦商業銀行",
    "shortName": "聯邦銀行",
    "category": "本國銀行"
  },
  {
    "code": "805",
    "branchCode": "8050012",
    "name": "遠東國際商業銀行",
    "shortName": "遠東銀行",
    "category": "本國銀行"
  },
  {
    "code": "806",
    "branchCode": "8060013",
    "name": "元大商業銀行",
    "shortName": "元大銀行",
    "category": "本國銀行"
  },
  {
    "code": "807",
    "branchCode": "8070014",
    "name": "永豐商業銀行",
    "shortName": "永豐銀行",
    "category": "本國銀行"
  },
  {
    "code": "808",
    "branchCode": "8080015",
    "name": "玉山商業銀行",
    "shortName": "玉山銀行",
    "category": "本國銀行"
  },
  {
    "code": "809",
    "branchCode": "8090016",
    "name": "凱基商業銀行",
    "shortName": "凱基銀行",
    "category": "本國銀行"
  },
  {
    "code": "810",
    "branchCode": "8100054",
    "name": "星展（台灣）商業銀行",
    "shortName": "星展台灣",
    "category": "本國銀行"
  },
  {
    "code": "812",
    "branchCode": "8120012",
    "name": "台新國際商業銀行",
    "shortName": "台新銀行",
    "category": "本國銀行"
  },
  {
    "code": "816",
    "branchCode": "8160016",
    "name": "安泰商業銀行",
    "shortName": "安泰銀行",
    "category": "本國銀行"
  },
  {
    "code": "822",
    "branchCode": "8220015",
    "name": "中國信託商業銀行",
    "shortName": "中信銀行",
    "category": "本國銀行"
  },
  {
    "code": "823",
    "branchCode": "8231688",
    "name": "將來商業銀行",
    "shortName": "將來銀行",
    "category": "純網銀"
  },
  {
    "code": "824",
    "branchCode": "8246880",
    "name": "連線商業銀行",
    "shortName": "連線銀行",
    "category": "純網銀"
  },
  {
    "code": "826",
    "branchCode": "8260019",
    "name": "樂天國際商業銀行",
    "shortName": "樂天銀行",
    "category": "純網銀"
  },
  {
    "code": "860",
    "branchCode": "8600015",
    "name": "中埔鄉農會",
    "shortName": "中埔農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "866",
    "branchCode": "8660011",
    "name": "阿里山鄉農會",
    "shortName": "阿里山農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "868",
    "branchCode": "8680013",
    "name": "東勢區農會",
    "shortName": "東勢區農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "869",
    "branchCode": "8690014",
    "name": "清水區農會",
    "shortName": "清水農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "870",
    "branchCode": "8700018",
    "name": "梧棲區農會",
    "shortName": "梧棲農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "871",
    "branchCode": "8710019",
    "name": "大甲區農會",
    "shortName": "大甲農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "872",
    "branchCode": "8720010",
    "name": "沙鹿區農會",
    "shortName": "沙鹿農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "874",
    "branchCode": "8740012",
    "name": "霧峰區農會",
    "shortName": "霧峰農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "875",
    "branchCode": "8750013",
    "name": "太平區農會",
    "shortName": "太平農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "876",
    "branchCode": "8760014",
    "name": "烏日區農會",
    "shortName": "烏日農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "877",
    "branchCode": "8770015",
    "name": "后里區農會",
    "shortName": "后里農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "878",
    "branchCode": "8780016",
    "name": "大雅區農會",
    "shortName": "大雅農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "879",
    "branchCode": "8790017",
    "name": "潭子區農會",
    "shortName": "潭子農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "880",
    "branchCode": "8800011",
    "name": "石岡區農會",
    "shortName": "石岡農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "881",
    "branchCode": "8810012",
    "name": "新社區農會",
    "shortName": "新社農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "882",
    "branchCode": "8820013",
    "name": "大肚區農會",
    "shortName": "大肚農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "883",
    "branchCode": "8830014",
    "name": "外埔區農會",
    "shortName": "外埔農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "884",
    "branchCode": "8840015",
    "name": "大安區農會",
    "shortName": "大安農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "885",
    "branchCode": "8850016",
    "name": "龍井區農會",
    "shortName": "龍井農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "886",
    "branchCode": "8860017",
    "name": "和平區農會",
    "shortName": "和平農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "889",
    "branchCode": "8890010",
    "name": "神岡區農會",
    "shortName": "神岡農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "891",
    "branchCode": "8910015",
    "name": "花蓮市農會",
    "shortName": "花蓮農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "895",
    "branchCode": "8950019",
    "name": "瑞穗鄉農會",
    "shortName": "瑞穗農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "896",
    "branchCode": "8960010",
    "name": "玉溪地區農會",
    "shortName": "玉溪農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "897",
    "branchCode": "8970011",
    "name": "鳳榮地區農會",
    "shortName": "鳳榮農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "898",
    "branchCode": "8980012",
    "name": "光豐地區農會",
    "shortName": "光豐農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "901",
    "branchCode": "9010015",
    "name": "大里區農會",
    "shortName": "大里農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "902",
    "branchCode": "9020016",
    "name": "苗栗市農會",
    "shortName": "苗栗農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "903",
    "branchCode": "9030017",
    "name": "汐止區農會",
    "shortName": "汐止農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "904",
    "branchCode": "9040018",
    "name": "新莊區農會",
    "shortName": "新莊農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "906",
    "branchCode": "9060010",
    "name": "頭份市農會",
    "shortName": "頭份農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "907",
    "branchCode": "9070011",
    "name": "竹南鎮農會",
    "shortName": "竹南農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "908",
    "branchCode": "9080012",
    "name": "通霄鎮農會",
    "shortName": "通霄農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "909",
    "branchCode": "9090013",
    "name": "苑裡鎮農會",
    "shortName": "苑裡農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "912",
    "branchCode": "9120019",
    "name": "冬山鄉農會",
    "shortName": "冬山農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "913",
    "branchCode": "9130010",
    "name": "後龍鎮農會",
    "shortName": "後龍農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "914",
    "branchCode": "9140011",
    "name": "卓蘭鎮農會",
    "shortName": "卓蘭農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "915",
    "branchCode": "9150012",
    "name": "西湖鄉農會",
    "shortName": "西湖農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "916",
    "branchCode": "9160013",
    "name": "草屯鎮農會",
    "shortName": "草屯農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "917",
    "branchCode": "9170014",
    "name": "公館鄉農會",
    "shortName": "公館農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "918",
    "branchCode": "9180015",
    "name": "銅鑼鄉農會",
    "shortName": "銅鑼農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "919",
    "branchCode": "9190016",
    "name": "三義鄉農會",
    "shortName": "三義農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "920",
    "branchCode": "9200010",
    "name": "造橋鄉農會",
    "shortName": "造橋農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "921",
    "branchCode": "9210011",
    "name": "南庄鄉農會",
    "shortName": "南庄農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "922",
    "branchCode": "9220012",
    "name": "臺南市臺南地區農會",
    "shortName": "臺南農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "923",
    "branchCode": "9230013",
    "name": "獅潭鄉農會",
    "shortName": "獅潭農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "924",
    "branchCode": "9240014",
    "name": "頭屋鄉農會",
    "shortName": "頭屋農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "925",
    "branchCode": "9250015",
    "name": "三灣鄉農會",
    "shortName": "三灣農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "926",
    "branchCode": "9260016",
    "name": "苗栗縣大湖地區農會",
    "shortName": "大湖農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "928",
    "branchCode": "9280018",
    "name": "板橋區農會",
    "shortName": "板橋農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "929",
    "branchCode": "9290019",
    "name": "關西鎮農會",
    "shortName": "關西農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "930",
    "branchCode": "9300013",
    "name": "新埔鎮農會",
    "shortName": "新埔農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "931",
    "branchCode": "9310014",
    "name": "竹北市農會",
    "shortName": "竹北農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "932",
    "branchCode": "9320015",
    "name": "湖口鄉農會",
    "shortName": "湖口農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "933",
    "branchCode": "9330016",
    "name": "芎林鄉農會",
    "shortName": "芎林農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "934",
    "branchCode": "9340017",
    "name": "寶山鄉農會",
    "shortName": "寶山農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "935",
    "branchCode": "9350018",
    "name": "峨眉鄉農會",
    "shortName": "峨眉農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "936",
    "branchCode": "9360019",
    "name": "北埔鄉農會",
    "shortName": "北埔農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "937",
    "branchCode": "9370010",
    "name": "竹東地區農會",
    "shortName": "竹東農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "938",
    "branchCode": "9380011",
    "name": "橫山地區農會",
    "shortName": "橫山農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "939",
    "branchCode": "9390012",
    "name": "新豐鄉農會",
    "shortName": "新豐農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "940",
    "branchCode": "9400016",
    "name": "新竹市農會",
    "shortName": "新竹市農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "952",
    "branchCode": "9520103",
    "name": "小港區農會",
    "shortName": "小港農會",
    "category": "農漁會信用部",
    "centerName": "南農中心所屬會員"
  },
  {
    "code": "953",
    "branchCode": "9530012",
    "name": "田尾鄉農會",
    "shortName": "田尾農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "984",
    "branchCode": "9840012",
    "name": "北投區農會",
    "shortName": "北投農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "985",
    "branchCode": "9850013",
    "name": "士林區農會",
    "shortName": "士林農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "986",
    "branchCode": "9860014",
    "name": "內湖區農會",
    "shortName": "內湖農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "987",
    "branchCode": "9870015",
    "name": "南港區農會",
    "shortName": "南港農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "988",
    "branchCode": "9880016",
    "name": "木柵區農會",
    "shortName": "木柵農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "989",
    "branchCode": "9890017",
    "name": "景美區農會",
    "shortName": "景美農會",
    "category": "農漁會信用部",
    "centerName": "農金資訊所屬會員"
  },
  {
    "code": "996",
    "branchCode": "9960017",
    "name": "財政部國庫署",
    "shortName": "國庫署",
    "category": "本國銀行"
  }
];

/**
 * 根據 3 碼總代號或 7 碼通匯代號查詢所有符合的金融機構
 * （例如南農中心 616 共用代號下包含斗南鎮農會 6160056、斗六市農會 6160012 等 13 家雲林縣農會）
 */
export function getBanksByCode(code?: string): BankInfo[] {
  if (!code) return [];
  const trimmed = code.trim();
  if (!trimmed) return [];
  if (trimmed.length === 7) {
    const exact7 = TAIWAN_BANKS.filter(b => b.branchCode === trimmed);
    if (exact7.length > 0) return exact7;
    const head3 = trimmed.slice(0, 3);
    return TAIWAN_BANKS.filter(b => b.code === head3);
  }
  const padded = trimmed.padStart(3, '0');
  return TAIWAN_BANKS.filter(b => b.code === padded || b.code === trimmed);
}

/**
 * 根據 3 碼或 7 碼代號查詢單一金融機構（若提供機構名稱則優先精準比對共用代號下的農漁會）
 */
export function getBankByCode(code?: string, bankName?: string): BankInfo | undefined {
  const matches = getBanksByCode(code);
  if (matches.length === 0) return undefined;
  if (bankName) {
    const normTarget = bankName.trim().replace(/台/g, '臺');
    const exact = matches.find(
      m =>
        m.name.replace(/台/g, '臺') === normTarget ||
        m.shortName.replace(/台/g, '臺') === normTarget
    );
    if (exact) return exact;
  }
  return matches[0];
}

/**
 * 智慧搜尋金融機構（支援 3 碼代號、7 碼通匯代號、全名、簡稱，並自動相容「台/臺」異體字及分類過濾）
 */
export function searchTaiwanBanks(
  keyword?: string,
  category: 'ALL' | BankCategory = 'ALL'
): BankInfo[] {
  const baseList =
    category === 'ALL'
      ? TAIWAN_BANKS
      : TAIWAN_BANKS.filter(b => b.category === category);

  if (!keyword || !keyword.trim()) return baseList;

  const q = keyword.trim().toLowerCase();
  const qNorm = q.replace(/台/g, '臺');

  return baseList.filter(b => {
    const nameNorm = b.name.toLowerCase().replace(/台/g, '臺');
    const shortNorm = b.shortName.toLowerCase().replace(/台/g, '臺');
    const centerNorm = (b.centerName || '').toLowerCase().replace(/台/g, '臺');
    return (
      b.code.includes(q) ||
      (b.branchCode && b.branchCode.includes(q)) ||
      nameNorm.includes(qNorm) ||
      shortNorm.includes(qNorm) ||
      centerNorm.includes(qNorm)
    );
  });
}
