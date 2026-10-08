// 臺灣全國金融機構代碼與機構清冊資料庫 (涵蓋本國銀行、外商銀行、信用合作社、中華郵政、各縣市農漁會信用部)

export interface BankInfo {
  code: string;
  name: string;
  shortName: string;
  category: '本國銀行' | '外商銀行' | '信用合作社' | '農漁會信用部' | '郵政機構' | '純網銀';
}

export const TAIWAN_BANKS: BankInfo[] = [
  // 本國主要商業與公營銀行
  { code: '004', name: '臺灣銀行', shortName: '台銀', category: '本國銀行' },
  { code: '005', name: '臺灣土地銀行', shortName: '土銀', category: '本國銀行' },
  { code: '006', name: '合作金庫商業銀行', shortName: '合庫', category: '本國銀行' },
  { code: '007', name: '第一商業銀行', shortName: '一銀', category: '本國銀行' },
  { code: '008', name: '華南商業銀行', shortName: '華南', category: '本國銀行' },
  { code: '009', name: '彰化商業銀行', shortName: '彰銀', category: '本國銀行' },
  { code: '011', name: '上海商業儲蓄銀行', shortName: '上海商銀', category: '本國銀行' },
  { code: '012', name: '台北富邦商業銀行', shortName: '富邦銀行', category: '本國銀行' },
  { code: '013', name: '國泰世華商業銀行', shortName: '國泰世華', category: '本國銀行' },
  { code: '016', name: '高雄銀行', shortName: '高雄銀', category: '本國銀行' },
  { code: '017', name: '兆豐國際商業銀行', shortName: '兆豐銀行', category: '本國銀行' },
  { code: '048', name: '王道商業銀行 (原台灣工銀)', shortName: '王道銀行', category: '本國銀行' },
  { code: '050', name: '臺灣中小企業銀行', shortName: '台企銀', category: '本國銀行' },
  { code: '052', name: '渣打國際商業銀行', shortName: '渣打銀行', category: '本國銀行' },
  { code: '053', name: '台中商業銀行', shortName: '台中銀', category: '本國銀行' },
  { code: '054', name: '京城商業銀行', shortName: '京城銀', category: '本國銀行' },
  { code: '101', name: '瑞興商業銀行', shortName: '瑞興銀', category: '本國銀行' },
  { code: '102', name: '華泰商業銀行', shortName: '華泰銀', category: '本國銀行' },
  { code: '103', name: '臺灣新光商業銀行', shortName: '新光銀行', category: '本國銀行' },
  { code: '108', name: '陽信商業銀行', shortName: '陽信銀行', category: '本國銀行' },
  { code: '118', name: '板信商業銀行', shortName: '板信銀行', category: '本國銀行' },
  { code: '803', name: '聯邦商業銀行', shortName: '聯邦銀行', category: '本國銀行' },
  { code: '805', name: '遠東國際商業銀行', shortName: '遠東商銀', category: '本國銀行' },
  { code: '806', name: '元大商業銀行', shortName: '元大銀行', category: '本國銀行' },
  { code: '807', name: '永豐商業銀行', shortName: '永豐銀行', category: '本國銀行' },
  { code: '808', name: '玉山商業銀行', shortName: '玉山銀行', category: '本國銀行' },
  { code: '809', name: '凱基商業銀行 (原萬泰)', shortName: '凱基銀行', category: '本國銀行' },
  { code: '812', name: '台新國際商業銀行', shortName: '台新銀行', category: '本國銀行' },
  { code: '816', name: '安泰商業銀行', shortName: '安泰銀行', category: '本國銀行' },
  { code: '822', name: '中國信託商業銀行', shortName: '中信銀', category: '本國銀行' },

  // 純網路銀行
  { code: '824', name: '連線商業銀行 (LINE Bank)', shortName: 'LINE Bank', category: '純網銀' },
  { code: '826', name: '樂天國際商業銀行', shortName: '樂天銀行', category: '純網銀' },
  { code: '827', name: '將來商業銀行 (NEXT Bank)', shortName: '將來銀行', category: '純網銀' },

  // 外商在台銀行
  { code: '021', name: '花旗(台灣)商業銀行', shortName: '花旗銀行', category: '外商銀行' },
  { code: '081', name: '滙豐(台灣)商業銀行', shortName: '滙豐銀行', category: '外商銀行' },
  { code: '810', name: '星展(台灣)商業銀行', shortName: '星展銀行', category: '外商銀行' },
  { code: '022', name: '美國銀行在台分行', shortName: '美銀', category: '外商銀行' },
  { code: '023', name: '美國紐約梅隆銀行台北分行', shortName: '紐約梅隆', category: '外商銀行' },
  { code: '025', name: '首都銀行台北分行', shortName: '首都銀', category: '外商銀行' },
  { code: '039', name: '澳商澳盛銀行台北分行', shortName: '澳盛銀', category: '外商銀行' },
  { code: '075', name: '法商東方匯理銀行台北分行', shortName: '東方匯理', category: '外商銀行' },
  { code: '085', name: '新加坡商大華銀行台北分行', shortName: '大華銀', category: '外商銀行' },

  // 信用合作社 (全國代表性社)
  { code: '114', name: '基隆市第一信用合作社', shortName: '基隆一信', category: '信用合作社' },
  { code: '115', name: '基隆市第二信用合作社', shortName: '基隆二信', category: '信用合作社' },
  { code: '119', name: '淡水第一信用合作社', shortName: '淡水一信', category: '信用合作社' },
  { code: '120', name: '新北市淡水信用合作社', shortName: '淡水信合社', category: '信用合作社' },
  { code: '124', name: '宜蘭信用合作社', shortName: '宜蘭信合社', category: '信用合作社' },
  { code: '127', name: '桃園信用合作社', shortName: '桃信', category: '信用合作社' },
  { code: '130', name: '新竹第一信用合作社', shortName: '新竹一信', category: '信用合作社' },
  { code: '132', name: '新竹第三信用合作社', shortName: '新竹三信', category: '信用合作社' },
  { code: '146', name: '台中市第二信用合作社', shortName: '台中二信', category: '信用合作社' },
  { code: '158', name: '彰化第一信用合作社', shortName: '彰化一信', category: '信用合作社' },
  { code: '161', name: '彰化第五信用合作社', shortName: '彰化五信', category: '信用合作社' },
  { code: '162', name: '彰化第六信用合作社', shortName: '彰化六信', category: '信用合作社' },
  { code: '163', name: '彰化第十信用合作社', shortName: '彰化十信', category: '信用合作社' },
  { code: '165', name: '彰化縣鹿港信用合作社', shortName: '鹿港信合社', category: '信用合作社' },
  { code: '178', name: '嘉義市第三信用合作社', shortName: '嘉義三信', category: '信用合作社' },
  { code: '179', name: '嘉義市第四信用合作社', shortName: '嘉義四信', category: '信用合作社' },
  { code: '188', name: '台南市第三信用合作社', shortName: '台南三信', category: '信用合作社' },
  { code: '204', name: '高雄市第三信用合作社', shortName: '高雄三信', category: '信用合作社' },
  { code: '215', name: '花蓮第一信用合作社', shortName: '花蓮一信', category: '信用合作社' },
  { code: '216', name: '花蓮第二信用合作社', shortName: '花蓮二信', category: '信用合作社' },
  { code: '222', name: '澎湖第一信用合作社', shortName: '澎湖一信', category: '信用合作社' },
  { code: '223', name: '澎湖縣第二信用合作社', shortName: '澎湖二信', category: '信用合作社' },
  { code: '224', name: '金門縣信用合作社', shortName: '金門信合社', category: '信用合作社' },

  // 中華郵政
  { code: '700', name: '中華郵政股份有限公司 (郵局儲匯)', shortName: '中華郵政/郵局', category: '郵政機構' },

  // 農會與漁會信用部 (全國主要代表性基層金融機構)
  { code: '501', name: '宜蘭市農會信用部', shortName: '宜蘭市農會', category: '農漁會信用部' },
  { code: '502', name: '羅東鎮農會信用部', shortName: '羅東農會', category: '農漁會信用部' },
  { code: '506', name: '頭城鎮農會信用部', shortName: '頭城農會', category: '農漁會信用部' },
  { code: '512', name: '板橋區農會信用部', shortName: '板橋農會', category: '農漁會信用部' },
  { code: '515', name: '三重區農會信用部', shortName: '三重農會', category: '農漁會信用部' },
  { code: '517', name: '中和地區農會信用部', shortName: '中和農會', category: '農漁會信用部' },
  { code: '518', name: '新店地區農會信用部', shortName: '新店農會', category: '農漁會信用部' },
  { code: '521', name: '淡水區農會信用部', shortName: '淡水農會', category: '農漁會信用部' },
  { code: '524', name: '五股區農會信用部', shortName: '五股農會', category: '農漁會信用部' },
  { code: '525', name: '林口區農會信用部', shortName: '林口農會', category: '農漁會信用部' },
  { code: '600', name: '農金資訊股份有限公司 (全國農漁會跨行通匯系統)', shortName: '農金資/農漁會', category: '農漁會信用部' },
  { code: '605', name: '高雄市農會信用部', shortName: '高雄市農會', category: '農漁會信用部' },
  { code: '612', name: '神岡區農會信用部', shortName: '神岡農會', category: '農漁會信用部' },
  { code: '614', name: '霧峰區農會信用部', shortName: '霧峰農會', category: '農漁會信用部' },
  { code: '616', name: '彰化市農會信用部', shortName: '彰化農會', category: '農漁會信用部' },
  { code: '617', name: '員林市農會信用部', shortName: '員林農會', category: '農漁會信用部' },
  { code: '618', name: '南投市農會信用部', shortName: '南投農會', category: '農漁會信用部' },
  { code: '619', name: '草屯鎮農會信用部', shortName: '草屯農會', category: '農漁會信用部' },
  { code: '620', name: '嘉義市農會信用部', shortName: '嘉義市農會', category: '農漁會信用部' },
  { code: '622', name: '台南地區農會信用部', shortName: '台南農會', category: '農漁會信用部' },
  { code: '624', name: '屏東市農會信用部', shortName: '屏東農會', category: '農漁會信用部' },
  { code: '910', name: '全國農業金庫股份有限公司', shortName: '農業金庫', category: '農漁會信用部' },
  { code: '928', name: '新北市板橋區農會資訊中心', shortName: '北農中心', category: '農漁會信用部' },
  { code: '951', name: '全國農會資訊中心 (農資中心)', shortName: '全國農資', category: '農漁會信用部' },
  { code: '952', name: '南農中心 (南部各縣市農漁會信用部)', shortName: '南農中心', category: '農漁會信用部' },
  { code: '954', name: '農漁會聯合資訊中心 (中崙中心)', shortName: '中崙中心', category: '農漁會信用部' },

  // 更多各縣市重要農漁會信用部
  { code: '503', name: '礁溪鄉農會信用部', shortName: '礁溪農會', category: '農漁會信用部' },
  { code: '508', name: '五結鄉農會信用部', shortName: '五結農會', category: '農漁會信用部' },
  { code: '516', name: '三峽區農會信用部', shortName: '三峽農會', category: '農漁會信用部' },
  { code: '519', name: '樹林區農會信用部', shortName: '樹林農會', category: '農漁會信用部' },
  { code: '520', name: '鶯歌區農會信用部', shortName: '鶯歌農會', category: '農漁會信用部' },
  { code: '523', name: '新莊區農會信用部', shortName: '新莊農會', category: '農漁會信用部' },
  { code: '526', name: '泰山區農會信用部', shortName: '泰山農會', category: '農漁會信用部' },
  { code: '527', name: '八里區農會信用部', shortName: '八里農會', category: '農漁會信用部' },
  { code: '535', name: '瑞芳地區農會信用部', shortName: '瑞芳農會', category: '農漁會信用部' },
  { code: '542', name: '竹南鎮農會信用部', shortName: '竹南農會', category: '農漁會信用部' },
  { code: '543', name: '頭份市農會信用部', shortName: '頭份農會', category: '農漁會信用部' },
  { code: '607', name: '大里區農會信用部', shortName: '大里農會', category: '農漁會信用部' },
  { code: '608', name: '太平區農會信用部', shortName: '太平農會', category: '農漁會信用部' },
  { code: '613', name: '大雅區農會信用部', shortName: '大雅農會', category: '農漁會信用部' },
  { code: '615', name: '東勢區農會信用部', shortName: '東勢農會', category: '農漁會信用部' },
  { code: '621', name: '民雄鄉農會信用部', shortName: '民雄農會', category: '農漁會信用部' },
  { code: '623', name: '鳳山區農會信用部', shortName: '鳳山農會', category: '農漁會信用部' },
  { code: '625', name: '屏東市農會信用部', shortName: '屏東市農會', category: '農漁會信用部' },
  { code: '627', name: '花蓮市農會信用部', shortName: '花蓮市農會', category: '農漁會信用部' },
  { code: '628', name: '吉安鄉農會信用部', shortName: '吉安農會', category: '農漁會信用部' },
  { code: '640', name: '太麻里地區農會信用部', shortName: '太麻里農會', category: '農漁會信用部' },
  { code: '642', name: '臺東地區農會信用部', shortName: '臺東農會', category: '農漁會信用部' },
  { code: '643', name: '新港區漁會信用部', shortName: '新港漁會', category: '農漁會信用部' },
  { code: '645', name: '澎湖縣農會信用部', shortName: '澎湖縣農會', category: '農漁會信用部' },
  { code: '646', name: '金門縣農會信用部', shortName: '金門縣農會', category: '農漁會信用部' },
  { code: '647', name: '連江縣農會信用部', shortName: '連江縣農會', category: '農漁會信用部' },
  { code: '901', name: '基隆市農會信用部', shortName: '基隆市農會', category: '農漁會信用部' },
  { code: '903', name: '汐止區農會信用部', shortName: '汐止農會', category: '農漁會信用部' },
  { code: '904', name: '新店地區農會資訊部', shortName: '新店資訊部', category: '農漁會信用部' }
];

// 根據 3 碼銀行機構代碼查找
export function getBankByCode(code?: string): BankInfo | undefined {
  if (!code) return undefined;
  const cleanCode = code.trim().padStart(3, '0');
  return TAIWAN_BANKS.find(b => b.code === cleanCode || b.code === code.trim());
}

// 全文搜尋金融機構 (支援代碼、名稱、簡稱、別稱搜尋)
export function searchTaiwanBanks(keyword: string): BankInfo[] {
  if (!keyword || !keyword.trim()) return TAIWAN_BANKS;
  const q = keyword.trim().toLowerCase();
  return TAIWAN_BANKS.filter(
    b =>
      b.code.includes(q) ||
      b.name.toLowerCase().includes(q) ||
      b.shortName.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q)
  );
}
