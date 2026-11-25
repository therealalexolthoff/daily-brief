// Every feed the site reads. Add or remove a line to change the mix.
//   type:    "wire" (news agency) or "rss" (publisher feed)
//   section: default section for its stories; null = decide per story
//   weight:  how much one outlet's coverage counts towards a story's rank
const gnews = (site) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`site:${site} when:1d`)}&hl=en-US&gl=US&ceid=US:en`;

export const SOURCES = [
  // --- News wires ---
  // AP and Reuters have no public RSS feed, so their headlines come via Google News RSS.
  { outlet: 'AP', type: 'wire', section: null, weight: 1.5, url: gnews('apnews.com/article'), via: 'Google News' },
  { outlet: 'Reuters', type: 'wire', section: null, weight: 1.5, url: gnews('reuters.com'), via: 'Google News' },
  { outlet: 'UPI', type: 'wire', section: null, weight: 1.2, url: 'https://rss.upi.com/news/news.rss' },
  { outlet: 'Anadolu', type: 'wire', section: 'World', weight: 1, url: 'https://www.aa.com.tr/en/rss/default?cat=live' },
  { outlet: 'Yonhap', type: 'wire', section: 'World', weight: 0.7, url: 'https://en.yna.co.kr/RSS/news.xml' },
  { outlet: 'ANSA', type: 'wire', section: 'World', weight: 0.7, url: 'https://www.ansa.it/english/english_rss.xml' },

  // --- Publisher RSS ---
  { outlet: 'BBC', type: 'rss', section: 'World', weight: 1, url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { outlet: 'BBC', type: 'rss', section: 'U.S.', weight: 1, url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml' },
  { outlet: 'BBC', type: 'rss', section: 'Business', weight: 1, url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { outlet: 'BBC', type: 'rss', section: 'Technology', weight: 1, url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { outlet: 'BBC', type: 'rss', section: 'Science & Health', weight: 1, url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { outlet: 'NPR', type: 'rss', section: 'U.S.', weight: 1, url: 'https://feeds.npr.org/1003/rss.xml' },
  { outlet: 'NPR', type: 'rss', section: 'World', weight: 1, url: 'https://feeds.npr.org/1004/rss.xml' },
  { outlet: 'NPR', type: 'rss', section: 'Politics', weight: 1, url: 'https://feeds.npr.org/1014/rss.xml' },
  { outlet: 'NPR', type: 'rss', section: 'Business', weight: 1, url: 'https://feeds.npr.org/1006/rss.xml' },
  { outlet: 'NPR', type: 'rss', section: 'Science & Health', weight: 1, url: 'https://feeds.npr.org/1007/rss.xml' },
  { outlet: 'NY Times', type: 'rss', section: 'U.S.', weight: 1, url: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml' },
  { outlet: 'NY Times', type: 'rss', section: 'World', weight: 1, url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { outlet: 'NY Times', type: 'rss', section: 'Politics', weight: 1, url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml' },
  { outlet: 'NY Times', type: 'rss', section: 'Business', weight: 1, url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
  { outlet: 'NY Times', type: 'rss', section: 'Science & Health', weight: 1, url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml' },
  { outlet: 'Guardian', type: 'rss', section: 'World', weight: 1, url: 'https://www.theguardian.com/world/rss' },
  { outlet: 'CBS News', type: 'rss', section: 'U.S.', weight: 1, url: 'https://www.cbsnews.com/latest/rss/us' },
  { outlet: 'CBS News', type: 'rss', section: 'Politics', weight: 1, url: 'https://www.cbsnews.com/latest/rss/politics' },
  { outlet: 'ABC News', type: 'rss', section: null, weight: 1, url: 'https://abcnews.go.com/abcnews/topstories' },
  { outlet: 'PBS', type: 'rss', section: null, weight: 1, url: 'https://www.pbs.org/newshour/feeds/rss/headlines' },
  { outlet: 'Al Jazeera', type: 'rss', section: 'World', weight: 1, url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { outlet: 'DW', type: 'rss', section: 'World', weight: 0.8, url: 'https://rss.dw.com/rdf/rss-en-all' },
  { outlet: 'France 24', type: 'rss', section: 'World', weight: 0.8, url: 'https://www.france24.com/en/rss' },
  { outlet: 'CNBC', type: 'rss', section: 'Business', weight: 1, url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { outlet: 'Ars Technica', type: 'rss', section: 'Technology', weight: 0.8, url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { outlet: 'The Verge', type: 'rss', section: 'Technology', weight: 0.8, url: 'https://www.theverge.com/rss/index.xml' },
  { outlet: 'ESPN', type: 'rss', section: 'Sports', weight: 0.8, url: 'https://www.espn.com/espn/rss/news' },
  { outlet: 'BBC', type: 'rss', section: 'Sports', weight: 0.7, url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
];

export const SECTIONS = ['U.S.', 'World', 'Politics', 'Business', 'Technology', 'Science & Health', 'Sports'];
