import fs from "node:fs/promises";

const football = [
  ["Manchester United", "The Red Devils / «красные дьяволы»", "Красный дьявол с трезубцем; корабль напоминает о Манчестере."],
  ["Arsenal", "The Gunners / «канониры»", "Главный знак — пушка; прозвище связано с происхождением клуба при оружейном заводе."],
  ["Liverpool", "The Reds / «красные»", "Птица liver bird, ворота Shankly Gates и два пламени памяти."],
  ["Chelsea", "The Blues / «синие»", "Синий лев с посохом; розы и футбольные мячи по краям."],
  ["Tottenham Hotspur", "Spurs / The Lilywhites", "Петух, стоящий на футбольном мяче; связь с Хотспуром и петушиными боями."],
  ["Manchester City", "The Citizens / The Sky Blues", "Золотой корабль, красная ланкаширская роза и дата 1894."],
  ["Newcastle United", "The Magpies / «сороки»", "Чёрно-белые полосы; на гербе морские коньки и городской замок."],
  ["West Ham United", "The Hammers / «молотобойцы»", "Два скрещённых клепальных молота — наследие Thames Ironworks."],
  ["Real Madrid", "Los Blancos / Los Merengues", "Монограмма MCF, диагональная полоса и королевская корона."],
  ["Barcelona", "Blaugrana / «сине-гранатовые»", "Крест Святого Георгия, каталонские полосы, цвета клуба и мяч."],
  ["Atlético Madrid", "Los Colchoneros / «матрасники»", "Красно-белые полосы; медведь и земляничное дерево — символ Мадрида."],
  ["Valencia", "Los Murciélagos / «летучие мыши»", "Летучая мышь над щитом; один из самых узнаваемых зоосимволов Ла Лиги."],
  ["Juventus", "La Vecchia Signora / «старая синьора»", "Современный знак — стилизованная буква J; исторические цвета чёрный и белый."],
  ["Milan", "Rossoneri / «красно-чёрные»", "Красно-чёрные полосы и красный крест Святого Амвросия на белом поле."],
  ["Inter", "Nerazzurri / «чёрно-синие»", "Переплетённая монограмма I–M; дополнительный символ клуба — змея biscione."],
  ["Roma", "Giallorossi / «жёлто-красные»", "Капитолийская волчица кормит Ромула и Рема."],
  ["Lazio", "Biancocelesti / «бело-голубые»", "Золотой орёл над щитом; имя клуба отсылает к региону Лацио."],
  ["Bayern München", "Die Roten / «красные»", "Сине-белые баварские ромбы внутри красного кольца."],
  ["Ajax", "de Godenzonen / «сыновья богов»", "Профиль мифологического Аякса, собранный из одиннадцати линий — по числу игроков."],
  ["Benfica", "As Águias / «орлы»", "Орёл над щитом, колесо велосипеда и девиз E pluribus unum."],
];

const worldCup2026Groups = [
  ["Группа A", "Мексика · Южная Африка · Республика Корея · Чехия", "Хозяева турнира: Мексика. Запоминайте связку: CONCACAF + CAF + AFC + UEFA."],
  ["Группа B", "Канада · Босния и Герцеговина · Катар · Швейцария", "Хозяева турнира: Канада. По одной сборной из CONCACAF, UEFA, AFC и ещё одна UEFA."],
  ["Группа C", "Бразилия · Марокко · Гаити · Шотландия", "Пятикратный чемпион, полуфиналист ЧМ-2022, представитель Карибов и сборная Великобритании."],
  ["Группа D", "США · Австралия · Парагвай · Турция", "Хозяева турнира: США. CONCACAF + AFC + CONMEBOL + UEFA."],
  ["Группа E", "Германия · Кюрасао · Кот-д’Ивуар · Эквадор", "Четырёхкратный чемпион и три сборные из разных конфедераций: CONCACAF, CAF и CONMEBOL."],
  ["Группа F", "Нидерланды · Япония · Швеция · Тунис", "Трижды финалист ЧМ, азиатский лидер, европейская и африканская сборные."],
  ["Группа G", "Бельгия · Египет · Иран · Новая Зеландия", "UEFA + CAF + AFC + OFC; ориентиры — Де Брёйне, Салах, Тареми и Крис Вуд."],
  ["Группа H", "Испания · Саудовская Аравия · Уругвай · Кабо-Верде", "Будущий чемпион турнира попал к двукратному чемпиону мира Уругваю, представителям AFC и CAF."],
  ["Группа I", "Франция · Сенегал · Норвегия · Ирак", "Группа Мбаппе и будущих участников гонки бомбардиров: Хорланда и французского капитана."],
  ["Группа J", "Аргентина · Австрия · Алжир · Иордания", "Действующий на старте чемпион дошёл до финала; Месси забил восемь голов за турнир."],
  ["Группа K", "Португалия · Узбекистан · Колумбия · ДР Конго", "Европа, Азия, Южная Америка и Африка — по одной сборной от четырёх конфедераций."],
  ["Группа L", "Англия · Гана · Панама · Хорватия", "Англия завоевала бронзу; вместе с ней — представители CAF, CONCACAF и финалист ЧМ-2018."],
];

const worldCup2026Awards = [
  ["Чемпион мира 2026", "Испания", "Победила Аргентину 1:0 в дополнительное время; решающий гол Феррана Торреса на 106-й минуте."],
  ["adidas Golden Ball · лучший игрок", "Родри · Испания", "Капитан и центральный полузащитник чемпиона; FIFA отметила его управление темпом, прессингом и владением."],
  ["FIFA Young Player Award · лучший молодой игрок", "Пау Кубарси · Испания", "Центральный защитник стал лучшим молодым игроком турнира и одним из ключевых игроков чемпионской обороны."],
  ["adidas Golden Glove · лучший вратарь", "Унаи Симон · Испания", "Семь сухих матчей из восьми и лишь один пропущенный мяч за весь турнир."],
];

const worldCup2026Scorers = [
  ["1-е место · 10 голов", "Килиан Мбаппе · Франция", "adidas Golden Boot; также сделал 4 голевые передачи."],
  ["2-е место · 8 голов", "Лионель Месси · Аргентина", "Дошёл до финала и сделал 4 голевые передачи."],
  ["3-е место · 7 голов", "Джуд Беллингем · Англия", "Забил 7 мячей и сделал 1 голевую передачу."],
  ["4-е место · 7 голов", "Эрлинг Холанд · Норвегия", "Забил 7 мячей; уступил Беллингему по дополнительному показателю."],
  ["5-е место · 6 голов", "Усман Дембеле · Франция", "Забил 6 мячей и сделал 2 голевые передачи."],
];

const leagues = {
  NBA: `
ATL|Atlanta Hawks
BOS|Boston Celtics
BKN|Brooklyn Nets
CHA|Charlotte Hornets
CHI|Chicago Bulls
CLE|Cleveland Cavaliers
DAL|Dallas Mavericks
DEN|Denver Nuggets
DET|Detroit Pistons
GSW|Golden State Warriors
HOU|Houston Rockets
IND|Indiana Pacers
LAC|Los Angeles Clippers
LAL|Los Angeles Lakers
MEM|Memphis Grizzlies
MIA|Miami Heat
MIL|Milwaukee Bucks
MIN|Minnesota Timberwolves
NOP|New Orleans Pelicans
NYK|New York Knicks
OKC|Oklahoma City Thunder
ORL|Orlando Magic
PHI|Philadelphia 76ers
PHX|Phoenix Suns
POR|Portland Trail Blazers
SAC|Sacramento Kings
SAS|San Antonio Spurs
TOR|Toronto Raptors
UTA|Utah Jazz
WAS|Washington Wizards`,
  NHL: `
ANA|Anaheim Ducks
BOS|Boston Bruins
BUF|Buffalo Sabres
CAR|Carolina Hurricanes
CBJ|Columbus Blue Jackets
CGY|Calgary Flames
CHI|Chicago Blackhawks
COL|Colorado Avalanche
DAL|Dallas Stars
DET|Detroit Red Wings
EDM|Edmonton Oilers
FLA|Florida Panthers
LAK|Los Angeles Kings
MIN|Minnesota Wild
MTL|Montréal Canadiens
NJD|New Jersey Devils
NSH|Nashville Predators
NYI|New York Islanders
NYR|New York Rangers
OTT|Ottawa Senators
PHI|Philadelphia Flyers
PIT|Pittsburgh Penguins
SEA|Seattle Kraken
SJS|San Jose Sharks
STL|St. Louis Blues
TBL|Tampa Bay Lightning
TOR|Toronto Maple Leafs
UTA|Utah Mammoth
VAN|Vancouver Canucks
VGK|Vegas Golden Knights
WPG|Winnipeg Jets
WSH|Washington Capitals`,
  NFL: `
ARI|Arizona Cardinals
ATL|Atlanta Falcons
BAL|Baltimore Ravens
BUF|Buffalo Bills
CAR|Carolina Panthers
CHI|Chicago Bears
CIN|Cincinnati Bengals
CLE|Cleveland Browns
DAL|Dallas Cowboys
DEN|Denver Broncos
DET|Detroit Lions
GB|Green Bay Packers
HOU|Houston Texans
IND|Indianapolis Colts
JAX|Jacksonville Jaguars
KC|Kansas City Chiefs
LV|Las Vegas Raiders
LAC|Los Angeles Chargers
LAR|Los Angeles Rams
MIA|Miami Dolphins
MIN|Minnesota Vikings
NE|New England Patriots
NO|New Orleans Saints
NYG|New York Giants
NYJ|New York Jets
PHI|Philadelphia Eagles
PIT|Pittsburgh Steelers
SEA|Seattle Seahawks
SF|San Francisco 49ers
TB|Tampa Bay Buccaneers
TEN|Tennessee Titans
WAS|Washington Commanders`,
};

const campaigns = [
  ["Just Do It", "Nike · с 1988 года", "Знать бренд, слоган и связь с Майклом Джорданом, Сереной Уильямс, Коби Брайантом и другими звёздами."],
  ["Impossible Is Nothing", "adidas · запущена в 2004 году, перезапущена в 2021-м", "Оригинальная кампания связана с Мухаммедом Али; в новых версиях появлялись Месси, Салах и Кэндис Паркер."],
  ["Be Like Mike", "Gatorade · 1991", "Майкл Джордан и короткая музыкальная формула сделали кампанию одним из символов спортивной рекламы 1990-х."],
  ["Thank You, Mom", "P&G · олимпийская платформа 2010–2012", "Истории матерей спортсменов; особенно ассоциируется с Олимпиадой-2012 в Лондоне."],
  ["Mean Joe Greene", "Coca-Cola · 1979", "Мальчик отдаёт напиток звезде Pittsburgh Steelers, а Джо Грин бросает ему игровую майку."],
  ["This Is SportsCenter", "ESPN · с 1990-х", "Спортсмены появляются в офисе ESPN как обычные сотрудники; формат строится на абсурдном смешении спорта и работы."],
  ["Write the Future", "Nike Football · ЧМ-2010", "Ролик показывает, как одно действие футболиста меняет его воображаемое будущее; среди героев — Роналду, Руни и Дрогба."],
  ["The Game Before the Game", "Beats by Dre · ЧМ-2014", "Предматчевые ритуалы футболистов и болельщиков; центральная фигура — Неймар."],
  ["We’re the Superhumans", "Channel 4 · Паралимпиада-2016", "Музыкальный ролик о мастерстве спортсменов и людей с инвалидностью; важная британская спортивная кампания."],
  ["Dream Crazy", "Nike · 2018", "Кампания с Колином Каперником; ключевая тема — масштаб мечты и готовность чем-то пожертвовать."],
];

const nameBridges = [
  ["Андрей Рублёв", "Русский иконописец Андрей Рублёв", "Теннис + иконопись; фамилия позволяет строить заголовки вроде «вынес икону»."],
  ["Рубенс Баррикелло", "Питер Пауль Рубенс", "Формула-1 + живопись; Рубенс — имя гонщика и фамилия художника."],
  ["Данте Бонфим Коста Сантос", "Данте Алигьери", "Футбол + литература; общее имя Данте."],
  ["Кэм Ньютон", "Исаак Ньютон и единица силы", "NFL + математика + физика."],
  ["Джей Ти Тор", "Тор и его молот", "NBA + мифология + метание молота."],
  ["Штеффи Граф", "Graf — граф по-немецки", "Теннис + история титулов."],
  ["Роке Санта-Крус", "Топонимы Santa Cruz", "Футбол + география; города и островные столицы с тем же названием."],
  ["Садио Мане", "Эдуар Мане", "Футбол + живопись; фонетическая пара Мане/Manet."],
  ["Татьяна Навка", "Навка — дух в славянской мифологии", "Фигурное катание + мифология."],
  ["Неманья Видич", "VIDIC как буквенно-числовой ребус", "Футбол + римские цифры: V–I–D–I–C."],
  ["Тимофей Мозгов", "«Мозгов» как форма обычного слова", "NBA + литература; фамилия в цитате может выглядеть как существительное."],
  ["Себастьян Лёб и Себастьян Феттель", "Сан-Себастьян", "Автоспорт + география; общее имя спрятано в названии города."],
  ["Ламар Одом и Ламар Джексон", "Кендрик Ламар", "NBA + NFL + музыка; одно имя в трёх областях."],
  ["Уэйн Руни", "Шрек — известное прозвище", "Футбол + анимация; внешность и медийное прозвище."],
  ["Гарет Бэйл", "bale — тюк; Bale — фамилия актёра Кристиана Бэйла", "Футбол + язык + кино; учитывать разные произношения."],
  ["Диего Коста", "Costa — берег и распространённый топонимический элемент", "Футбол + география + испанский/португальский язык."],
];

const mythology = [
  ["Зевс / Юпитер", "Верховный бог; молния и орёл.", "Греция / Рим"],
  ["Гера / Юнона", "Супруга верховного бога; покровительница брака.", "Греция / Рим"],
  ["Посейдон / Нептун", "Море и трезубец.", "Греция / Рим"],
  ["Арес / Марс", "Бог войны.", "Греция / Рим"],
  ["Афродита / Венера", "Любовь и красота; «Рождение Венеры».", "Греция / Рим"],
  ["Гермес / Меркурий", "Вестник богов; крылатые сандалии и кадуцей.", "Греция / Рим"],
  ["Афина / Минерва", "Мудрость и военная стратегия; сова.", "Греция / Рим"],
  ["Геракл / Геркулес", "Герой двенадцати подвигов; имя клуба Hércules.", "Греция / Рим"],
  ["Ника / Виктория", "Богиня победы; крылатая фигура.", "Греция / Рим"],
  ["Аид / Плутон", "Подземный мир.", "Греция / Рим"],
  ["Аякс", "Герой Троянской войны; профиль на эмблеме амстердамского клуба.", "Греция"],
  ["Тор", "Гром и молот Мьёльнир.", "Скандинавия"],
  ["Один", "Одноглазый верховный бог; вороны Хугин и Мунин.", "Скандинавия"],
  ["Анубис", "Шакалоголовый бог, связанный с бальзамированием; карта Counter-Strike.", "Египет"],
  ["Ра", "Солнечный бог; имя удобно для звуковых и числовых ребусов.", "Египет"],
  ["Гор", "Сокол, небо и царская власть.", "Египет"],
  ["Георгий Победоносец", "Всадник поражает дракона; знаком по российским монетам.", "Христианство"],
  ["Двенадцать апостолов", "Пётр, Андрей, Иаков, Иоанн, Филипп, Варфоломей, Фома, Матфей, Иаков Алфеев, Фаддей, Симон, Иуда.", "Христианство"],
  ["Пасхальные символы", "Яйцо, агнец, крест и воскресение; часто связываются с английскими спортивными метафорами.", "Христианство"],
  ["Навка", "Женский дух умершего в славянской мифологии.", "Славянская традиция"],
];

const popCulture = [
  ["You’ll Never Walk Alone", "Gerry and the Pacemakers", "Гимн Liverpool; также поётся болельщиками Celtic и ряда других клубов."],
  ["Seven Nation Army", "The White Stripes", "Мелодия превратилась в международную стадионную кричалку."],
  ["Freed from Desire", "Gala", "Основа футбольной кричалки Will Grigg’s on Fire и множества её вариантов."],
  ["We Are the Champions", "Queen", "Универсальная песня победителей; регулярно звучит после финалов."],
  ["A Kind of Magic", "Queen", "Связка с Magic Johnson и Orlando Magic; использовалась в рекламе Coca-Cola."],
  ["Eye of the Tiger", "Survivor", "Главная музыкальная ассоциация с фильмом Rocky III."],
  ["Sirius", "The Alan Parsons Project", "Знаменитое интро Chicago Bulls эпохи Майкла Джордана."],
  ["Chelsea Dagger", "The Fratellis", "Голевая песня Chicago Blackhawks."],
  ["Sweet Caroline", "Neil Diamond", "Сильная связь с Boston Red Sox и английскими футбольными болельщиками."],
  ["Take Me Out to the Ball Game", "Нора Бэйес / Джек Норворт и Альберт фон Тильцер", "Неофициальный гимн бейсбола в США."],
  ["Three Lions", "Baddiel, Skinner & The Lightning Seeds", "Футбольная сборная Англии и формула Football’s Coming Home."],
  ["Wavin’ Flag", "K’naan", "Прочно ассоциируется с чемпионатом мира по футболу 2010 года."],
  ["Keane", "Группа из саундтрека FIFA 07", "Название совпадает с фамилиями Роя Кина и Робби Кина."],
  ["«Бей-беги»", "«Кровосток»", "Одновременно песня, ироничное описание футбольной тактики и название медиафутбольной команды."],
  ["Moneyball / «Человек, который изменил всё»", "Фильм 2011 года", "Бейсбол, Oakland Athletics и аналитический подход Билли Бина."],
  ["Space Jam", "Фильм 1996 года", "Майкл Джордан, Looney Tunes и баскетбол."],
  ["Rocky", "Серия фильмов", "Бокс, Филадельфия и тренировочные монтажи."],
  ["Raging Bull / «Бешеный бык»", "Фильм 1980 года", "Боксёр Джейк Ламотта; режиссёр Мартин Скорсезе."],
  ["Chariots of Fire / «Огненные колесницы»", "Фильм 1981 года", "Британские бегуны и Олимпиада-1924."],
  ["Cool Runnings", "Фильм 1993 года", "Ямайская команда по бобслею на Олимпиаде-1988."],
  ["Goal!", "Фильм 2005 года", "Футболист Сантьяго Муньес и Newcastle United."],
  ["Remember the Titans", "Фильм 2000 года", "Школьный американский футбол и команда Titans."],
  ["I, Tonya / «Тоня против всех»", "Фильм 2017 года", "Фигуристка Тоня Хардинг."],
  ["Rush / «Гонка»", "Фильм 2013 года", "Противостояние Ники Лауды и Джеймса Ханта в Формуле-1."],
];

const sources = [
  ["NBA: официальный список команд", "https://www.nba.com/teams"],
  ["NHL: официальный список команд", "https://www.nhl.com/info/teams/"],
  ["NFL: официальный список 32 команд", "https://www.nfl.com/teams/"],
  ["Nike: история Just Do It", "https://about.nike.com/en-GB/newsroom/releases/nike-reintroduces-just-do-it-to-todays-generation-with-why-do-it-campaign"],
  ["adidas: история бренда и Impossible Is Nothing", "https://www.adidas-group.com/en/about/history"],
  ["P&G: олимпийская кампания Thank You, Mom", "https://us.pg.com/blogs/pg-announces-extended-olympic-games-partnership/"],
  ["Coca-Cola: Mean Joe Greene", "https://www.coca-colacompany.com/about-us/history/cokes-enduring-legacy-of-inclusive-advertising"],
  ["FIFA: состав групп чемпионата мира 2026", "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/fifa-world-cup-2026-hosts-cities-dates-usa-mexico-canada"],
  ["FIFA: статистика и бомбардиры чемпионата мира 2026", "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/statistics"],
  ["FIFA: Родри — обладатель Golden Ball", "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/untouchable-rodri-the-master-and-commander-as-spain-prevail"],
  ["FIFA: Мбаппе — обладатель Golden Boot", "https://www.fifa.com/en/articles/adidas-golden-boot-race-top-scorer"],
  ["FIFA: Унаи Симон — обладатель Golden Glove", "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/unai-simon-adidas-golden-glove"],
  ["FIFA: лучший молодой игрок чемпионата мира 2026", "https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/young-player"],
];

function parseLeague(name, text) {
  return text
    .trim()
    .split("\n")
    .map((line) => {
      const [code, team] = line.split("|");
      return [code, team, name];
    });
}

const leagueCards = Object.entries(leagues).flatMap(([name, text]) =>
  parseLeague(name, text),
);
const trainingData = {
  football,
  worldCup2026Groups,
  worldCup2026Awards,
  worldCup2026Scorers,
  leagueCards,
  campaigns,
  nameBridges,
  mythology,
  popCulture,
  sources,
};

const worldCup2026CardCount =
  worldCup2026Groups.length + worldCup2026Awards.length + worldCup2026Scorers.length;
const totalCardCount =
  football.length +
  worldCup2026CardCount +
  leagueCards.length +
  campaigns.length +
  nameBridges.length +
  mythology.length +
  popCulture.length;

const embedded = JSON.stringify(trainingData).replaceAll("<", "\\u003c");
const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Симпл Квиз — тренажёр команды</title>
  <style>
    :root{--ink:#152033;--muted:#667085;--paper:#f2f5f9;--card:#fff;--line:#dce3eb;--navy:#17365d;--blue:#5b9bd5;--violet:#7030a0;--green:#16835a;--amber:#f5b942;--shadow:0 12px 30px rgba(20,32,51,.09)}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
    button,input{font:inherit}.top{position:sticky;top:0;z-index:20;display:flex;gap:12px;align-items:center;padding:12px 18px;background:#101d30;color:#fff;box-shadow:0 5px 20px #101d3033}
    .brand{font-weight:850;white-space:nowrap}.tabs{display:flex;gap:6px;overflow:auto}.tab{border:0;border-radius:9px;padding:8px 11px;background:transparent;color:#cbd5e1;cursor:pointer;white-space:nowrap}.tab.active,.tab:hover{background:#2a405f;color:#fff}
    .search{margin-left:auto;width:230px;border:1px solid #41536c;border-radius:9px;padding:8px 10px;background:#182942;color:#fff}
    main{max-width:1460px;margin:auto;padding:24px}.hero{display:grid;grid-template-columns:1fr auto;gap:24px;padding:30px 34px;border-radius:20px;background:linear-gradient(135deg,var(--navy),#274f7d);color:#fff;box-shadow:var(--shadow)}
    .eyebrow{margin:0 0 7px;color:#bfd0e5;font-size:11px;font-weight:800;letter-spacing:.15em}.hero h1{margin:0;font-size:clamp(30px,5vw,52px);line-height:1.05}.hero p{max-width:820px;color:#dce8f5}.timer{display:grid;place-items:center;min-width:155px;padding:18px;border-radius:18px;background:#ffffff12}.timer strong{font-size:42px}.timer button{border:0;border-radius:9px;padding:7px 12px;background:var(--amber);cursor:pointer}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0}.stat{padding:17px;border-radius:14px;background:#fff;box-shadow:var(--shadow)}.stat b{display:block;color:var(--navy);font-size:29px}.stat span{color:var(--muted);font-size:13px}
    .plan{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}.plan article{padding:18px;border-left:5px solid var(--blue);border-radius:12px;background:#fff;box-shadow:var(--shadow)}.plan h3{margin:0 0 7px}.plan p{margin:0;color:var(--muted)}
    .section-head{display:flex;justify-content:space-between;align-items:end;gap:18px;margin:25px 0 13px}.section-head h2{margin:0;font-size:32px}.section-head p{margin:0;color:var(--muted)}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
    .card{position:relative;padding:0;border:1px solid var(--line);border-radius:13px;background:#fff;box-shadow:0 7px 20px #1420330d;overflow:hidden}.card[hidden]{display:none}.card details{height:100%}.card summary{min-height:95px;padding:18px 48px 18px 18px;cursor:pointer;font-weight:750;list-style:none}.card summary::-webkit-details-marker{display:none}.card summary small{display:block;margin-top:6px;color:var(--muted);font-weight:500}.answer{padding:15px 18px 18px;border-top:1px solid var(--line);background:#f8fbff}.answer b{color:var(--navy)}.answer p{margin:7px 0 0;color:#435168}
    .learned{position:absolute;top:12px;right:12px;z-index:2;width:22px;height:22px;accent-color:var(--green)}.card:has(.learned:checked){border-color:#70c7a7;background:#f1fff9}.code{display:inline-grid;place-items:center;min-width:58px;padding:6px 9px;border-radius:8px;background:var(--navy);color:#fff;font-size:19px;letter-spacing:.06em}
    .league-filter{display:flex;gap:7px}.league-filter button{border:1px solid var(--line);border-radius:8px;padding:7px 10px;background:#fff;cursor:pointer}.league-filter button.active{background:var(--violet);color:#fff;border-color:var(--violet)}
    .sources{margin-top:22px;padding:20px;border-radius:14px;background:#fff;box-shadow:var(--shadow)}.sources a{color:#165a96}.sources li+li{margin-top:7px}.empty{padding:30px;text-align:center;color:var(--muted)}
    @media(max-width:850px){.top{align-items:flex-start;flex-wrap:wrap}.search{order:3;width:100%;margin:0}.stats{grid-template-columns:1fr 1fr}.plan{grid-template-columns:1fr}.timer{display:none}.hero{grid-template-columns:1fr}.section-head{align-items:start;flex-direction:column}}@media(max-width:520px){main{padding:14px}.stats{grid-template-columns:1fr}.hero{padding:23px}.cards{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header class="top">
    <div class="brand">SQ · Тренажёр</div>
    <nav class="tabs">
      <button class="tab active" data-section="overview">План</button>
      <button class="tab" data-section="football">Футбол</button>
      <button class="tab" data-section="worldcup2026">ЧМ-2026</button>
      <button class="tab" data-section="leagues">NBA / NHL / NFL</button>
      <button class="tab" data-section="campaigns">Реклама</button>
      <button class="tab" data-section="names">Имена</button>
      <button class="tab" data-section="mythology">Мифология</button>
      <button class="tab" data-section="culture">Музыка и кино</button>
    </nav>
    <input class="search" id="search" placeholder="Поиск по карточкам" hidden>
  </header>
  <main>
    <section id="overview">
      <div class="hero">
        <div><p class="eyebrow">ПОДГОТОВКА К СЛЕДУЮЩЕМУ КВИЗУ</p><h1>Закрытие областей</h1><p>Офлайн-тренажёр по самым полезным зонам: чемпионат мира 2026, футбольные символы, 94 команды американских лиг, спортивная реклама, имена-мосты, мифология, песни и кино. Нажимайте на карточку, чтобы открыть ответ, и отмечайте выученное.</p></div>
        <div class="timer"><span>Таймер вопроса</span><strong id="timer">60</strong><button id="timer-button">Старт</button></div>
      </div>
      <div class="stats">
        <div class="stat"><b>${football.length}</b><span>футбольных эмблем</span></div>
        <div class="stat"><b>${worldCup2026CardCount}</b><span>карточка по ЧМ-2026</span></div>
        <div class="stat"><b>${leagueCards.length}</b><span>команды трёх лиг</span></div>
        <div class="stat"><b>${campaigns.length}</b><span>рекламных кампаний</span></div>
        <div class="stat"><b id="progress">0/${totalCardCount}</b><span>карточек выучено</span></div>
      </div>
      <div class="plan">
        <article><h3>Сессия 1 · 60 минут</h3><p>Футбольные прозвища и эмблемы, затем NBA/NHL/NFL. Отвечать в обе стороны: код → команда и команда → код.</p></article>
        <article><h3>Сессия 2 · 60 минут</h3><p>Реклама, имена-мосты и мифология. После ответа обязательно проговаривать цепочку связи.</p></article>
        <article><h3>Сессия 3 · 60 минут</h3><p>Музыка и кино, затем смешанный прогон карточек с таймером 60 секунд.</p></article>
        <article><h3>Сессия 4 · 45 минут</h3><p>ЧМ-2026: двенадцать групп, обладатели индивидуальных наград и пятёрка лучших бомбардиров.</p></article>
      </div>
      <div class="sources"><h2>Как заниматься</h2><ol><li>Первый круг: открыть все карточки и отметить знакомые.</li><li>Второй круг: показывать только невыученные и отвечать за 20–30 секунд.</li><li>Третий круг: один участник читает подсказку, остальные строят цепочку вслух.</li><li>Перед игрой повторить карточки без отметки.</li></ol></div>
    </section>
    <section id="content" hidden>
      <div class="section-head"><div><p class="eyebrow">УЧЕБНЫЕ КАРТОЧКИ</p><h2 id="section-title"></h2><p id="section-note"></p></div><div class="league-filter" id="league-filter" hidden><button class="active" data-league="ALL">Все</button><button data-league="NBA">NBA</button><button data-league="NHL">NHL</button><button data-league="NFL">NFL</button></div></div>
      <div class="cards" id="cards"></div>
      <div class="empty" id="empty" hidden>Ничего не найдено.</div>
      <div class="sources" id="sources" hidden><h2>Источники для проверки</h2><ul>${sources.map(([name,url])=>`<li><a href="${url}" target="_blank">${name}</a></li>`).join("")}</ul></div>
    </section>
  </main>
  <script>
    const DATA=${embedded};
    const sections={
      football:{title:"20 футбольных прозвищ и эмблем",note:"Сначала назовите прозвище, затем опишите ключевые элементы эмблемы."},
      worldcup2026:{title:"Чемпионат мира FIFA 2026",note:"12 групп, главные индивидуальные награды и пятёрка лучших бомбардиров по итогам турнира."},
      leagues:{title:"Сокращения NBA, NHL и NFL",note:"94 актуальные команды. Обратите внимание: UTA в NHL — Utah Mammoth."},
      campaigns:{title:"Спортивные рекламные кампании",note:"Запоминайте связку бренд → название → спортсмен → год или турнир."},
      names:{title:"Имена и фамилии-мосты",note:"Тренируйте переход от спортсмена к художнику, герою, слову или топониму."},
      mythology:{title:"Мифология и религия",note:"Минимальный набор образов, символов и греко-римских соответствий."},
      culture:{title:"Спорт в музыке и кино",note:"Запоминайте не сюжет целиком, а короткую ассоциативную связь."}
    };
    const cards=document.querySelector("#cards"),search=document.querySelector("#search"),overview=document.querySelector("#overview"),content=document.querySelector("#content"),leagueFilter=document.querySelector("#league-filter");
    let active="overview",league="ALL",timerId=null,time=60;
    function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
    function card(id,front,answer,note,tag=""){return '<article class="card" data-search="'+escapeHtml([front,answer,note,tag].join(" ").toLowerCase())+'" data-league="'+escapeHtml(tag)+'"><input class="learned" type="checkbox" data-id="'+id+'" aria-label="Выучено"><details><summary>'+front+(tag?'<small>'+escapeHtml(tag)+'</small>':"")+'</summary><div class="answer"><b>'+escapeHtml(answer)+'</b><p>'+escapeHtml(note)+'</p></div></details></article>'}
    function makeCards(name){
      if(name==="football")return DATA.football.map((x,i)=>card("f"+i,escapeHtml(x[0]),x[1],x[2])).join("");
      if(name==="worldcup2026")return [
        ...DATA.worldCup2026Groups.map((x,i)=>card("w26g"+i,escapeHtml(x[0]),x[1],x[2],"Группы")),
        ...DATA.worldCup2026Awards.map((x,i)=>card("w26a"+i,escapeHtml(x[0]),x[1],x[2],"Лучшие игроки")),
        ...DATA.worldCup2026Scorers.map((x,i)=>card("w26s"+i,escapeHtml(x[0]),x[1],x[2],"Бомбардиры")),
      ].join("");
      if(name==="leagues")return DATA.leagueCards.map((x,i)=>card("l"+i,'<span class="code">'+escapeHtml(x[0])+"</span>",x[1],"Назовите полное имя команды и лигу.",x[2])).join("");
      if(name==="campaigns")return DATA.campaigns.map((x,i)=>card("a"+i,escapeHtml(x[0]),x[1],x[2])).join("");
      if(name==="names")return DATA.nameBridges.map((x,i)=>card("n"+i,escapeHtml(x[0]),x[1],x[2])).join("");
      if(name==="mythology")return DATA.mythology.map((x,i)=>card("m"+i,escapeHtml(x[0]),x[1],x[2])).join("");
      return DATA.popCulture.map((x,i)=>card("c"+i,escapeHtml(x[0]),x[1],x[2])).join("");
    }
    function render(name){
      active=name;document.querySelectorAll(".tab").forEach(tab=>tab.classList.toggle("active",tab.dataset.section===name));overview.hidden=name!=="overview";content.hidden=name==="overview";search.hidden=name==="overview";
      if(name==="overview"){updateProgress();return}
      document.querySelector("#section-title").textContent=sections[name].title;document.querySelector("#section-note").textContent=sections[name].note;leagueFilter.hidden=name!=="leagues";document.querySelector("#sources").hidden=name!=="campaigns"&&name!=="leagues"&&name!=="worldcup2026";
      cards.innerHTML=makeCards(name);restoreChecks();filterCards();
    }
    function filterCards(){const query=search.value.trim().toLowerCase();let visible=0;cards.querySelectorAll(".card").forEach(item=>{const show=(!query||item.dataset.search.includes(query))&&(active!=="leagues"||league==="ALL"||item.dataset.league===league);item.hidden=!show;if(show)visible++});document.querySelector("#empty").hidden=visible>0}
    function saved(){try{return JSON.parse(localStorage.getItem("simple-quiz-training-progress")||"{}")}catch{return {}}}
    function restoreChecks(){const state=saved();cards.querySelectorAll(".learned").forEach(box=>{box.checked=Boolean(state[box.dataset.id]);box.addEventListener("change",()=>{const next=saved();next[box.dataset.id]=box.checked;localStorage.setItem("simple-quiz-training-progress",JSON.stringify(next));updateProgress()})})}
    function updateProgress(){const count=Object.values(saved()).filter(Boolean).length;document.querySelector("#progress").textContent=count+"/${totalCardCount}"}
    document.querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>render(tab.dataset.section)));search.addEventListener("input",filterCards);
    leagueFilter.addEventListener("click",event=>{const button=event.target.closest("button");if(!button)return;league=button.dataset.league;leagueFilter.querySelectorAll("button").forEach(item=>item.classList.toggle("active",item===button));filterCards()});
    document.querySelector("#timer-button").addEventListener("click",event=>{if(timerId){clearInterval(timerId);timerId=null;time=60;event.target.textContent="Старт";document.querySelector("#timer").textContent=time;return}time=60;event.target.textContent="Сброс";timerId=setInterval(()=>{time--;document.querySelector("#timer").textContent=time;if(time<=0){clearInterval(timerId);timerId=null;event.target.textContent="Старт"}},1000)});
    updateProgress();
  </script>
</body>
</html>`;

await fs.mkdir("outputs", { recursive: true });
await fs.writeFile("outputs/Simple_Quiz_Team_Training.html", html);
await fs.writeFile("Simple_Quiz_Team_Training.html", html);
console.log(
  JSON.stringify({
    football: football.length,
    worldCup2026: worldCup2026CardCount,
    leagueTeams: leagueCards.length,
    campaigns: campaigns.length,
    nameBridges: nameBridges.length,
    mythology: mythology.length,
    popCulture: popCulture.length,
    total: totalCardCount,
  }),
);
