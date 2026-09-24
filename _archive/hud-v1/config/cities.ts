// ---------------------------------------------------------------------------
// GLOBAL CITIES DATABASE
// Comprehensive registry of 200+ metropolitan centers monitored by the
// Global Atmospheric Surveillance Command (GASC). Coordinates verified
// against NGA GEOnet Names Server. Population figures approximate.
// ---------------------------------------------------------------------------

export interface CityData {
  name: string;
  country: string; // ISO 3166-1 alpha-2
  coordinates: [number, number]; // [lng, lat]
  population: number; // approximate, used for weighting
  region: string;
}

export const CITIES: CityData[] = [
  // ---------------------------------------------------------------------------
  // EAST ASIA (~50 cities)
  // ---------------------------------------------------------------------------
  { name: 'Tokyo', country: 'JP', coordinates: [139.6917, 35.6895], population: 14000000, region: 'East Asia' },
  { name: 'Osaka', country: 'JP', coordinates: [135.5023, 34.6937], population: 2750000, region: 'East Asia' },
  { name: 'Yokohama', country: 'JP', coordinates: [139.6380, 35.4437], population: 3750000, region: 'East Asia' },
  { name: 'Nagoya', country: 'JP', coordinates: [136.9066, 35.1815], population: 2320000, region: 'East Asia' },
  { name: 'Sapporo', country: 'JP', coordinates: [141.3469, 43.0621], population: 1970000, region: 'East Asia' },
  { name: 'Fukuoka', country: 'JP', coordinates: [130.4017, 33.5904], population: 1620000, region: 'East Asia' },
  { name: 'Kobe', country: 'JP', coordinates: [135.1955, 34.6901], population: 1530000, region: 'East Asia' },
  { name: 'Seoul', country: 'KR', coordinates: [126.9780, 37.5665], population: 9700000, region: 'East Asia' },
  { name: 'Busan', country: 'KR', coordinates: [129.0756, 35.1796], population: 3400000, region: 'East Asia' },
  { name: 'Incheon', country: 'KR', coordinates: [126.7052, 37.4563], population: 2950000, region: 'East Asia' },
  { name: 'Daegu', country: 'KR', coordinates: [128.6014, 35.8714], population: 2430000, region: 'East Asia' },
  { name: 'Beijing', country: 'CN', coordinates: [116.4074, 39.9042], population: 21500000, region: 'East Asia' },
  { name: 'Shanghai', country: 'CN', coordinates: [121.4737, 31.2304], population: 24900000, region: 'East Asia' },
  { name: 'Guangzhou', country: 'CN', coordinates: [113.2644, 23.1291], population: 15300000, region: 'East Asia' },
  { name: 'Shenzhen', country: 'CN', coordinates: [114.0579, 22.5431], population: 12600000, region: 'East Asia' },
  { name: 'Chengdu', country: 'CN', coordinates: [104.0665, 30.5723], population: 16300000, region: 'East Asia' },
  { name: 'Wuhan', country: 'CN', coordinates: [114.3055, 30.5928], population: 11100000, region: 'East Asia' },
  { name: 'Hangzhou', country: 'CN', coordinates: [120.1551, 30.2741], population: 10400000, region: 'East Asia' },
  { name: 'Nanjing', country: 'CN', coordinates: [118.7969, 32.0603], population: 9300000, region: 'East Asia' },
  { name: 'Tianjin', country: 'CN', coordinates: [117.3616, 39.3434], population: 13600000, region: 'East Asia' },
  { name: 'Chongqing', country: 'CN', coordinates: [106.5516, 29.5630], population: 16900000, region: 'East Asia' },
  { name: "Xi'an", country: 'CN', coordinates: [108.9402, 34.2658], population: 10000000, region: 'East Asia' },
  { name: 'Harbin', country: 'CN', coordinates: [126.6427, 45.7567], population: 5300000, region: 'East Asia' },
  { name: 'Shenyang', country: 'CN', coordinates: [123.4315, 41.8057], population: 8100000, region: 'East Asia' },
  { name: 'Dalian', country: 'CN', coordinates: [121.6147, 38.9140], population: 6000000, region: 'East Asia' },
  { name: 'Qingdao', country: 'CN', coordinates: [120.3826, 36.0671], population: 9500000, region: 'East Asia' },
  { name: 'Jinan', country: 'CN', coordinates: [117.1205, 36.6512], population: 8700000, region: 'East Asia' },
  { name: 'Zhengzhou', country: 'CN', coordinates: [113.6254, 34.7466], population: 10700000, region: 'East Asia' },
  { name: 'Changsha', country: 'CN', coordinates: [112.9388, 28.2282], population: 8400000, region: 'East Asia' },
  { name: 'Fuzhou', country: 'CN', coordinates: [119.2965, 26.0745], population: 7600000, region: 'East Asia' },
  { name: 'Kunming', country: 'CN', coordinates: [102.8329, 25.0389], population: 6600000, region: 'East Asia' },
  { name: 'Nanning', country: 'CN', coordinates: [108.3661, 22.8170], population: 7200000, region: 'East Asia' },
  { name: 'Hefei', country: 'CN', coordinates: [117.2272, 31.8206], population: 8100000, region: 'East Asia' },
  { name: 'Changchun', country: 'CN', coordinates: [125.3245, 43.8868], population: 4500000, region: 'East Asia' },
  { name: 'Suzhou', country: 'CN', coordinates: [120.5853, 31.2989], population: 7100000, region: 'East Asia' },
  { name: 'Dongguan', country: 'CN', coordinates: [113.7518, 23.0208], population: 8300000, region: 'East Asia' },
  { name: 'Foshan', country: 'CN', coordinates: [113.1219, 23.0218], population: 7900000, region: 'East Asia' },
  { name: 'Xiamen', country: 'CN', coordinates: [118.0894, 24.4798], population: 4000000, region: 'East Asia' },
  { name: 'Ningbo', country: 'CN', coordinates: [121.5440, 29.8683], population: 8200000, region: 'East Asia' },
  { name: 'Wenzhou', country: 'CN', coordinates: [120.6994, 27.9938], population: 3600000, region: 'East Asia' },
  { name: 'Hong Kong', country: 'HK', coordinates: [114.1694, 22.3193], population: 7500000, region: 'East Asia' },
  { name: 'Taipei', country: 'TW', coordinates: [121.5654, 25.0330], population: 2650000, region: 'East Asia' },
  { name: 'Kaohsiung', country: 'TW', coordinates: [120.3133, 22.6273], population: 2770000, region: 'East Asia' },
  { name: 'Taichung', country: 'TW', coordinates: [120.6736, 24.1477], population: 2800000, region: 'East Asia' },
  { name: 'Macau', country: 'MO', coordinates: [113.5439, 22.1987], population: 680000, region: 'East Asia' },
  { name: 'Ulaanbaatar', country: 'MN', coordinates: [106.9057, 47.8864], population: 1500000, region: 'East Asia' },
  { name: 'Pyongyang', country: 'KP', coordinates: [125.7625, 39.0392], population: 3200000, region: 'East Asia' },
  { name: 'Gwangju', country: 'KR', coordinates: [126.8526, 35.1595], population: 1500000, region: 'East Asia' },
  { name: 'Daejeon', country: 'KR', coordinates: [127.3845, 36.3504], population: 1490000, region: 'East Asia' },

  // ---------------------------------------------------------------------------
  // SOUTH ASIA (~35 cities)
  // ---------------------------------------------------------------------------
  { name: 'Mumbai', country: 'IN', coordinates: [72.8777, 19.0760], population: 20700000, region: 'South Asia' },
  { name: 'Delhi', country: 'IN', coordinates: [77.1025, 28.7041], population: 29400000, region: 'South Asia' },
  { name: 'Bangalore', country: 'IN', coordinates: [77.5946, 12.9716], population: 12300000, region: 'South Asia' },
  { name: 'Chennai', country: 'IN', coordinates: [80.2707, 13.0827], population: 10900000, region: 'South Asia' },
  { name: 'Kolkata', country: 'IN', coordinates: [88.3639, 22.5726], population: 14900000, region: 'South Asia' },
  { name: 'Hyderabad', country: 'IN', coordinates: [78.4867, 17.3850], population: 10000000, region: 'South Asia' },
  { name: 'Pune', country: 'IN', coordinates: [73.8567, 18.5204], population: 7400000, region: 'South Asia' },
  { name: 'Ahmedabad', country: 'IN', coordinates: [72.5714, 23.0225], population: 8000000, region: 'South Asia' },
  { name: 'Jaipur', country: 'IN', coordinates: [75.7873, 26.9124], population: 3900000, region: 'South Asia' },
  { name: 'Lucknow', country: 'IN', coordinates: [80.9462, 26.8467], population: 3600000, region: 'South Asia' },
  { name: 'Kanpur', country: 'IN', coordinates: [80.3319, 26.4499], population: 3100000, region: 'South Asia' },
  { name: 'Surat', country: 'IN', coordinates: [72.8311, 21.1702], population: 6500000, region: 'South Asia' },
  { name: 'Nagpur', country: 'IN', coordinates: [79.0882, 21.1458], population: 2900000, region: 'South Asia' },
  { name: 'Patna', country: 'IN', coordinates: [85.1376, 25.6093], population: 2500000, region: 'South Asia' },
  { name: 'Indore', country: 'IN', coordinates: [75.8577, 22.7196], population: 2700000, region: 'South Asia' },
  { name: 'Bhopal', country: 'IN', coordinates: [77.4126, 23.2599], population: 2300000, region: 'South Asia' },
  { name: 'Visakhapatnam', country: 'IN', coordinates: [83.2185, 17.6868], population: 2100000, region: 'South Asia' },
  { name: 'Vadodara', country: 'IN', coordinates: [73.1812, 22.3072], population: 2100000, region: 'South Asia' },
  { name: 'Coimbatore', country: 'IN', coordinates: [76.9558, 11.0168], population: 2200000, region: 'South Asia' },
  { name: 'Thiruvananthapuram', country: 'IN', coordinates: [76.9471, 8.5241], population: 1700000, region: 'South Asia' },
  { name: 'Karachi', country: 'PK', coordinates: [67.0011, 24.8607], population: 16100000, region: 'South Asia' },
  { name: 'Lahore', country: 'PK', coordinates: [74.3587, 31.5204], population: 12600000, region: 'South Asia' },
  { name: 'Islamabad', country: 'PK', coordinates: [73.0479, 33.6844], population: 1100000, region: 'South Asia' },
  { name: 'Faisalabad', country: 'PK', coordinates: [73.0740, 31.4504], population: 3600000, region: 'South Asia' },
  { name: 'Rawalpindi', country: 'PK', coordinates: [73.0169, 33.5651], population: 2200000, region: 'South Asia' },
  { name: 'Peshawar', country: 'PK', coordinates: [71.5249, 34.0151], population: 2000000, region: 'South Asia' },
  { name: 'Dhaka', country: 'BD', coordinates: [90.4125, 23.8103], population: 21700000, region: 'South Asia' },
  { name: 'Chittagong', country: 'BD', coordinates: [91.8123, 22.3569], population: 5100000, region: 'South Asia' },
  { name: 'Khulna', country: 'BD', coordinates: [89.5403, 22.8456], population: 1800000, region: 'South Asia' },
  { name: 'Colombo', country: 'LK', coordinates: [79.8612, 6.9271], population: 750000, region: 'South Asia' },
  { name: 'Kathmandu', country: 'NP', coordinates: [85.3240, 27.7172], population: 1400000, region: 'South Asia' },
  { name: 'Thimphu', country: 'BT', coordinates: [89.6386, 27.4728], population: 115000, region: 'South Asia' },
  { name: 'Male', country: 'MV', coordinates: [73.5093, 4.1755], population: 250000, region: 'South Asia' },
  { name: 'Guwahati', country: 'IN', coordinates: [91.7362, 26.1445], population: 1100000, region: 'South Asia' },
  { name: 'Kochi', country: 'IN', coordinates: [76.2673, 9.9312], population: 2100000, region: 'South Asia' },

  // ---------------------------------------------------------------------------
  // SOUTHEAST ASIA (~20 cities)
  // ---------------------------------------------------------------------------
  { name: 'Bangkok', country: 'TH', coordinates: [100.5018, 13.7563], population: 10700000, region: 'Southeast Asia' },
  { name: 'Ho Chi Minh City', country: 'VN', coordinates: [106.6297, 10.8231], population: 9000000, region: 'Southeast Asia' },
  { name: 'Hanoi', country: 'VN', coordinates: [105.8342, 21.0278], population: 8100000, region: 'Southeast Asia' },
  { name: 'Jakarta', country: 'ID', coordinates: [106.8456, -6.2088], population: 10600000, region: 'Southeast Asia' },
  { name: 'Surabaya', country: 'ID', coordinates: [112.7508, -7.2575], population: 3000000, region: 'Southeast Asia' },
  { name: 'Bandung', country: 'ID', coordinates: [107.6191, -6.9175], population: 2500000, region: 'Southeast Asia' },
  { name: 'Medan', country: 'ID', coordinates: [98.6722, 3.5952], population: 2400000, region: 'Southeast Asia' },
  { name: 'Semarang', country: 'ID', coordinates: [110.4203, -6.9666], population: 1800000, region: 'Southeast Asia' },
  { name: 'Manila', country: 'PH', coordinates: [120.9842, 14.5995], population: 1800000, region: 'Southeast Asia' },
  { name: 'Quezon City', country: 'PH', coordinates: [121.0437, 14.6760], population: 2900000, region: 'Southeast Asia' },
  { name: 'Cebu City', country: 'PH', coordinates: [123.8854, 10.3157], population: 960000, region: 'Southeast Asia' },
  { name: 'Davao', country: 'PH', coordinates: [125.6128, 7.1907], population: 1630000, region: 'Southeast Asia' },
  { name: 'Singapore', country: 'SG', coordinates: [103.8198, 1.3521], population: 5700000, region: 'Southeast Asia' },
  { name: 'Kuala Lumpur', country: 'MY', coordinates: [101.6869, 3.1390], population: 1800000, region: 'Southeast Asia' },
  { name: 'George Town', country: 'MY', coordinates: [100.3327, 5.4141], population: 800000, region: 'Southeast Asia' },
  { name: 'Phnom Penh', country: 'KH', coordinates: [104.9282, 11.5564], population: 2100000, region: 'Southeast Asia' },
  { name: 'Yangon', country: 'MM', coordinates: [96.1951, 16.8661], population: 5300000, region: 'Southeast Asia' },
  { name: 'Vientiane', country: 'LA', coordinates: [102.6331, 17.9757], population: 820000, region: 'Southeast Asia' },
  { name: 'Chiang Mai', country: 'TH', coordinates: [98.9817, 18.7883], population: 1200000, region: 'Southeast Asia' },

  // ---------------------------------------------------------------------------
  // EUROPE (~40 cities)
  // ---------------------------------------------------------------------------
  { name: 'London', country: 'GB', coordinates: [-0.1278, 51.5074], population: 9000000, region: 'Europe' },
  { name: 'Paris', country: 'FR', coordinates: [2.3522, 48.8566], population: 11000000, region: 'Europe' },
  { name: 'Berlin', country: 'DE', coordinates: [13.4050, 52.5200], population: 3700000, region: 'Europe' },
  { name: 'Madrid', country: 'ES', coordinates: [-3.7038, 40.4168], population: 6600000, region: 'Europe' },
  { name: 'Rome', country: 'IT', coordinates: [12.4964, 41.9028], population: 4300000, region: 'Europe' },
  { name: 'Barcelona', country: 'ES', coordinates: [2.1734, 41.3851], population: 5500000, region: 'Europe' },
  { name: 'Amsterdam', country: 'NL', coordinates: [4.9041, 52.3676], population: 870000, region: 'Europe' },
  { name: 'Brussels', country: 'BE', coordinates: [4.3517, 50.8503], population: 1200000, region: 'Europe' },
  { name: 'Vienna', country: 'AT', coordinates: [16.3738, 48.2082], population: 1900000, region: 'Europe' },
  { name: 'Munich', country: 'DE', coordinates: [11.5820, 48.1351], population: 1500000, region: 'Europe' },
  { name: 'Frankfurt', country: 'DE', coordinates: [8.6821, 50.1109], population: 750000, region: 'Europe' },
  { name: 'Hamburg', country: 'DE', coordinates: [9.9937, 53.5511], population: 1900000, region: 'Europe' },
  { name: 'Milan', country: 'IT', coordinates: [9.1900, 45.4642], population: 3100000, region: 'Europe' },
  { name: 'Naples', country: 'IT', coordinates: [14.2681, 40.8518], population: 3100000, region: 'Europe' },
  { name: 'Lisbon', country: 'PT', coordinates: [-9.1393, 38.7223], population: 2900000, region: 'Europe' },
  { name: 'Dublin', country: 'IE', coordinates: [-6.2603, 53.3498], population: 1400000, region: 'Europe' },
  { name: 'Edinburgh', country: 'GB', coordinates: [-3.1883, 55.9533], population: 540000, region: 'Europe' },
  { name: 'Copenhagen', country: 'DK', coordinates: [12.5683, 55.6761], population: 1300000, region: 'Europe' },
  { name: 'Stockholm', country: 'SE', coordinates: [18.0686, 59.3293], population: 1600000, region: 'Europe' },
  { name: 'Oslo', country: 'NO', coordinates: [10.7522, 59.9139], population: 1060000, region: 'Europe' },
  { name: 'Helsinki', country: 'FI', coordinates: [24.9384, 60.1699], population: 1300000, region: 'Europe' },
  { name: 'Warsaw', country: 'PL', coordinates: [21.0122, 52.2297], population: 1800000, region: 'Europe' },
  { name: 'Prague', country: 'CZ', coordinates: [14.4378, 50.0755], population: 1300000, region: 'Europe' },
  { name: 'Budapest', country: 'HU', coordinates: [19.0402, 47.4979], population: 1750000, region: 'Europe' },
  { name: 'Bucharest', country: 'RO', coordinates: [26.1025, 44.4268], population: 2100000, region: 'Europe' },
  { name: 'Athens', country: 'GR', coordinates: [23.7275, 37.9838], population: 3200000, region: 'Europe' },
  { name: 'Istanbul', country: 'TR', coordinates: [28.9784, 41.0082], population: 15500000, region: 'Europe' },
  { name: 'Moscow', country: 'RU', coordinates: [37.6173, 55.7558], population: 12600000, region: 'Europe' },
  { name: 'St Petersburg', country: 'RU', coordinates: [30.3351, 59.9343], population: 5400000, region: 'Europe' },
  { name: 'Kyiv', country: 'UA', coordinates: [30.5234, 50.4501], population: 3000000, region: 'Europe' },
  { name: 'Zurich', country: 'CH', coordinates: [8.5417, 47.3769], population: 420000, region: 'Europe' },
  { name: 'Geneva', country: 'CH', coordinates: [6.1432, 46.2044], population: 500000, region: 'Europe' },
  { name: 'Manchester', country: 'GB', coordinates: [-2.2426, 53.4808], population: 2800000, region: 'Europe' },
  { name: 'Lyon', country: 'FR', coordinates: [4.8357, 45.7640], population: 1700000, region: 'Europe' },
  { name: 'Marseille', country: 'FR', coordinates: [5.3698, 43.2965], population: 1600000, region: 'Europe' },
  { name: 'Krakow', country: 'PL', coordinates: [19.9450, 50.0647], population: 780000, region: 'Europe' },
  { name: 'Belgrade', country: 'RS', coordinates: [20.4489, 44.7866], population: 1400000, region: 'Europe' },
  { name: 'Sofia', country: 'BG', coordinates: [23.3219, 42.6977], population: 1300000, region: 'Europe' },
  { name: 'Riga', country: 'LV', coordinates: [24.1052, 56.9496], population: 630000, region: 'Europe' },
  { name: 'Bratislava', country: 'SK', coordinates: [17.1077, 48.1486], population: 440000, region: 'Europe' },

  // ---------------------------------------------------------------------------
  // NORTH AMERICA (~30 cities)
  // ---------------------------------------------------------------------------
  { name: 'New York', country: 'US', coordinates: [-74.0060, 40.7128], population: 8300000, region: 'North America' },
  { name: 'Los Angeles', country: 'US', coordinates: [-118.2437, 34.0522], population: 3900000, region: 'North America' },
  { name: 'Chicago', country: 'US', coordinates: [-87.6298, 41.8781], population: 2700000, region: 'North America' },
  { name: 'Houston', country: 'US', coordinates: [-95.3698, 29.7604], population: 2300000, region: 'North America' },
  { name: 'Phoenix', country: 'US', coordinates: [-112.0740, 33.4484], population: 1600000, region: 'North America' },
  { name: 'Philadelphia', country: 'US', coordinates: [-75.1652, 39.9526], population: 1600000, region: 'North America' },
  { name: 'San Antonio', country: 'US', coordinates: [-98.4936, 29.4241], population: 1500000, region: 'North America' },
  { name: 'San Diego', country: 'US', coordinates: [-117.1611, 32.7157], population: 1400000, region: 'North America' },
  { name: 'Dallas', country: 'US', coordinates: [-96.7970, 32.7767], population: 1300000, region: 'North America' },
  { name: 'San Francisco', country: 'US', coordinates: [-122.4194, 37.7749], population: 870000, region: 'North America' },
  { name: 'Seattle', country: 'US', coordinates: [-122.3321, 47.6062], population: 750000, region: 'North America' },
  { name: 'Denver', country: 'US', coordinates: [-104.9903, 39.7392], population: 720000, region: 'North America' },
  { name: 'Boston', country: 'US', coordinates: [-71.0589, 42.3601], population: 680000, region: 'North America' },
  { name: 'Atlanta', country: 'US', coordinates: [-84.3880, 33.7490], population: 500000, region: 'North America' },
  { name: 'Miami', country: 'US', coordinates: [-80.1918, 25.7617], population: 450000, region: 'North America' },
  { name: 'Minneapolis', country: 'US', coordinates: [-93.2650, 44.9778], population: 430000, region: 'North America' },
  { name: 'Detroit', country: 'US', coordinates: [-83.0458, 42.3314], population: 640000, region: 'North America' },
  { name: 'Portland', country: 'US', coordinates: [-122.6765, 45.5152], population: 650000, region: 'North America' },
  { name: 'Las Vegas', country: 'US', coordinates: [-115.1398, 36.1699], population: 650000, region: 'North America' },
  { name: 'Nashville', country: 'US', coordinates: [-86.7816, 36.1627], population: 690000, region: 'North America' },
  { name: 'Austin', country: 'US', coordinates: [-97.7431, 30.2672], population: 960000, region: 'North America' },
  { name: 'Toronto', country: 'CA', coordinates: [-79.3832, 43.6532], population: 2900000, region: 'North America' },
  { name: 'Montreal', country: 'CA', coordinates: [-73.5673, 45.5017], population: 1800000, region: 'North America' },
  { name: 'Vancouver', country: 'CA', coordinates: [-123.1216, 49.2827], population: 680000, region: 'North America' },
  { name: 'Calgary', country: 'CA', coordinates: [-114.0719, 51.0447], population: 1300000, region: 'North America' },
  { name: 'Ottawa', country: 'CA', coordinates: [-75.6972, 45.4215], population: 1000000, region: 'North America' },
  { name: 'Mexico City', country: 'MX', coordinates: [-99.1332, 19.4326], population: 21800000, region: 'North America' },
  { name: 'Guadalajara', country: 'MX', coordinates: [-103.3496, 20.6597], population: 5200000, region: 'North America' },
  { name: 'Monterrey', country: 'MX', coordinates: [-100.3161, 25.6866], population: 4700000, region: 'North America' },
  { name: 'Havana', country: 'CU', coordinates: [-82.3666, 23.1136], population: 2100000, region: 'North America' },

  // ---------------------------------------------------------------------------
  // SOUTH AMERICA (~20 cities)
  // ---------------------------------------------------------------------------
  { name: 'Sao Paulo', country: 'BR', coordinates: [-46.6333, -23.5505], population: 22000000, region: 'South America' },
  { name: 'Rio de Janeiro', country: 'BR', coordinates: [-43.1729, -22.9068], population: 13500000, region: 'South America' },
  { name: 'Brasilia', country: 'BR', coordinates: [-47.8825, -15.7942], population: 3000000, region: 'South America' },
  { name: 'Salvador', country: 'BR', coordinates: [-38.5108, -12.9714], population: 2900000, region: 'South America' },
  { name: 'Fortaleza', country: 'BR', coordinates: [-38.5267, -3.7172], population: 2700000, region: 'South America' },
  { name: 'Belo Horizonte', country: 'BR', coordinates: [-43.9378, -19.9167], population: 2500000, region: 'South America' },
  { name: 'Curitiba', country: 'BR', coordinates: [-49.2733, -25.4290], population: 1900000, region: 'South America' },
  { name: 'Recife', country: 'BR', coordinates: [-34.8771, -8.0476], population: 1650000, region: 'South America' },
  { name: 'Buenos Aires', country: 'AR', coordinates: [-58.3816, -34.6037], population: 15200000, region: 'South America' },
  { name: 'Cordoba', country: 'AR', coordinates: [-64.1810, -31.4201], population: 1500000, region: 'South America' },
  { name: 'Bogota', country: 'CO', coordinates: [-74.0721, 4.7110], population: 10700000, region: 'South America' },
  { name: 'Medellin', country: 'CO', coordinates: [-75.5636, 6.2442], population: 2500000, region: 'South America' },
  { name: 'Cali', country: 'CO', coordinates: [-76.5320, 3.4516], population: 2200000, region: 'South America' },
  { name: 'Lima', country: 'PE', coordinates: [-77.0428, -12.0464], population: 10400000, region: 'South America' },
  { name: 'Santiago', country: 'CL', coordinates: [-70.6693, -33.4489], population: 6800000, region: 'South America' },
  { name: 'Caracas', country: 'VE', coordinates: [-66.9036, 10.4806], population: 2900000, region: 'South America' },
  { name: 'Quito', country: 'EC', coordinates: [-78.4678, -0.1807], population: 1900000, region: 'South America' },
  { name: 'Guayaquil', country: 'EC', coordinates: [-79.8868, -2.1710], population: 2700000, region: 'South America' },
  { name: 'Montevideo', country: 'UY', coordinates: [-56.1645, -34.9011], population: 1800000, region: 'South America' },
  { name: 'La Paz', country: 'BO', coordinates: [-68.1193, -16.4897], population: 900000, region: 'South America' },

  // ---------------------------------------------------------------------------
  // AFRICA (~15 cities)
  // ---------------------------------------------------------------------------
  { name: 'Lagos', country: 'NG', coordinates: [3.3792, 6.5244], population: 15400000, region: 'Africa' },
  { name: 'Cairo', country: 'EG', coordinates: [31.2357, 30.0444], population: 20900000, region: 'Africa' },
  { name: 'Johannesburg', country: 'ZA', coordinates: [28.0473, -26.2041], population: 5800000, region: 'Africa' },
  { name: 'Nairobi', country: 'KE', coordinates: [36.8219, -1.2921], population: 4700000, region: 'Africa' },
  { name: 'Addis Ababa', country: 'ET', coordinates: [38.7578, 9.0192], population: 3600000, region: 'Africa' },
  { name: 'Dar es Salaam', country: 'TZ', coordinates: [39.2083, -6.7924], population: 6700000, region: 'Africa' },
  { name: 'Accra', country: 'GH', coordinates: [-0.1870, 5.6037], population: 2500000, region: 'Africa' },
  { name: 'Casablanca', country: 'MA', coordinates: [-7.5898, 33.5731], population: 3700000, region: 'Africa' },
  { name: 'Cape Town', country: 'ZA', coordinates: [18.4241, -33.9249], population: 4600000, region: 'Africa' },
  { name: 'Khartoum', country: 'SD', coordinates: [32.5599, 15.5007], population: 5800000, region: 'Africa' },
  { name: 'Kinshasa', country: 'CD', coordinates: [15.2663, -4.4419], population: 14300000, region: 'Africa' },
  { name: 'Luanda', country: 'AO', coordinates: [13.2343, -8.8390], population: 8300000, region: 'Africa' },
  { name: 'Algiers', country: 'DZ', coordinates: [3.0588, 36.7538], population: 3400000, region: 'Africa' },
  { name: 'Abuja', country: 'NG', coordinates: [7.4951, 9.0579], population: 3300000, region: 'Africa' },
  { name: 'Kampala', country: 'UG', coordinates: [32.5825, 0.3476], population: 1700000, region: 'Africa' },
  { name: 'Dakar', country: 'SN', coordinates: [-17.4677, 14.7167], population: 1150000, region: 'Africa' },

  // ---------------------------------------------------------------------------
  // MIDDLE EAST (~15 cities)
  // ---------------------------------------------------------------------------
  { name: 'Dubai', country: 'AE', coordinates: [55.2708, 25.2048], population: 3400000, region: 'Middle East' },
  { name: 'Abu Dhabi', country: 'AE', coordinates: [54.3773, 24.4539], population: 1500000, region: 'Middle East' },
  { name: 'Riyadh', country: 'SA', coordinates: [46.6753, 24.7136], population: 7500000, region: 'Middle East' },
  { name: 'Jeddah', country: 'SA', coordinates: [39.1925, 21.5858], population: 4700000, region: 'Middle East' },
  { name: 'Tehran', country: 'IR', coordinates: [51.3890, 35.6892], population: 9000000, region: 'Middle East' },
  { name: 'Isfahan', country: 'IR', coordinates: [51.6780, 32.6546], population: 2100000, region: 'Middle East' },
  { name: 'Baghdad', country: 'IQ', coordinates: [44.3661, 33.3152], population: 7700000, region: 'Middle East' },
  { name: 'Doha', country: 'QA', coordinates: [51.5310, 25.2854], population: 2400000, region: 'Middle East' },
  { name: 'Kuwait City', country: 'KW', coordinates: [47.9774, 29.3759], population: 2400000, region: 'Middle East' },
  { name: 'Muscat', country: 'OM', coordinates: [58.3829, 23.5880], population: 1400000, region: 'Middle East' },
  { name: 'Amman', country: 'JO', coordinates: [35.9106, 31.9454], population: 4000000, region: 'Middle East' },
  { name: 'Beirut', country: 'LB', coordinates: [35.5018, 33.8938], population: 2400000, region: 'Middle East' },
  { name: 'Tel Aviv', country: 'IL', coordinates: [34.7818, 32.0853], population: 4100000, region: 'Middle East' },
  { name: 'Jerusalem', country: 'IL', coordinates: [35.2137, 31.7683], population: 940000, region: 'Middle East' },
  { name: 'Ankara', country: 'TR', coordinates: [32.8597, 39.9334], population: 5700000, region: 'Middle East' },

  // ---------------------------------------------------------------------------
  // CENTRAL ASIA (~8 cities)
  // ---------------------------------------------------------------------------
  { name: 'Tashkent', country: 'UZ', coordinates: [69.2401, 41.2995], population: 2600000, region: 'Central Asia' },
  { name: 'Almaty', country: 'KZ', coordinates: [76.9286, 43.2220], population: 2000000, region: 'Central Asia' },
  { name: 'Nur-Sultan', country: 'KZ', coordinates: [71.4491, 51.1694], population: 1200000, region: 'Central Asia' },
  { name: 'Bishkek', country: 'KG', coordinates: [74.5698, 42.8746], population: 1100000, region: 'Central Asia' },
  { name: 'Dushanbe', country: 'TJ', coordinates: [68.7870, 38.5598], population: 900000, region: 'Central Asia' },
  { name: 'Ashgabat', country: 'TM', coordinates: [58.3833, 37.9601], population: 800000, region: 'Central Asia' },
  { name: 'Kabul', country: 'AF', coordinates: [69.1723, 34.5553], population: 4200000, region: 'Central Asia' },
  { name: 'Tbilisi', country: 'GE', coordinates: [44.7833, 41.7151], population: 1200000, region: 'Central Asia' },

  // ---------------------------------------------------------------------------
  // OCEANIA (~8 cities)
  // ---------------------------------------------------------------------------
  { name: 'Sydney', country: 'AU', coordinates: [151.2093, -33.8688], population: 5300000, region: 'Oceania' },
  { name: 'Melbourne', country: 'AU', coordinates: [144.9631, -37.8136], population: 5100000, region: 'Oceania' },
  { name: 'Brisbane', country: 'AU', coordinates: [153.0281, -27.4698], population: 2500000, region: 'Oceania' },
  { name: 'Perth', country: 'AU', coordinates: [115.8605, -31.9505], population: 2100000, region: 'Oceania' },
  { name: 'Adelaide', country: 'AU', coordinates: [138.6007, -34.9285], population: 1400000, region: 'Oceania' },
  { name: 'Auckland', country: 'NZ', coordinates: [174.7633, -36.8485], population: 1660000, region: 'Oceania' },
  { name: 'Wellington', country: 'NZ', coordinates: [174.7762, -41.2865], population: 420000, region: 'Oceania' },
  { name: 'Gold Coast', country: 'AU', coordinates: [153.4000, -28.0167], population: 700000, region: 'Oceania' },
];

// ---------------------------------------------------------------------------
// Pre-computed region -> cities mapping for rapid tactical lookups.
// Populated at module load time. O(n) initialization, O(1) per-region access.
// ---------------------------------------------------------------------------

export const CITIES_BY_REGION: Record<string, CityData[]> = {};

for (const city of CITIES) {
  if (!CITIES_BY_REGION[city.region]) {
    CITIES_BY_REGION[city.region] = [];
  }
  CITIES_BY_REGION[city.region].push(city);
}
