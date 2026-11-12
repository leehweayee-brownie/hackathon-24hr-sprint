/**
 * 20 more fictional suppliers, each with its documents (rendered as specimen PDFs), so the buyer
 * side has a realistic pool: CIDB grades G3–G7 across several states, most fully verified, and a
 * few with the gaps the rules engine and Vendor Match are built to catch (missing ISO or bank
 * letter, tax clearance about to expire, expired insurance, registration or name mismatches).
 * Additive and idempotent, like seed-vendor-match.ts: existing suppliers are skipped.
 *
 *   npm run db:seed:suppliers -w @vp/api
 */
import { docs, monthsAgo, monthsAhead, run, type DocSpec, type SupplierSpec } from './seed-vendor-match';

type Flag = 'noIso' | 'noBank' | 'taxExpiring' | 'plExpired' | 'cidbExpiring' | 'regMismatch' | 'nameMismatch';

interface Row {
  name: string;
  reg: string;
  owner: string;
  slug: string;
  address: string;
  incorporated: string;
  grade: string;
  categories: string;
  cover: number;
  insurer: string;
  bank: string;
  flags?: Flag[];
  jobs?: SupplierSpec['pastJobs'];
}

const ROWS: Row[] = [
  { name: 'Bumi Jaya Konkrit Sdn Bhd', reg: '200701018822 (778822-K)', owner: 'Ahmad Faizal bin Rahman', slug: 'bumijayakonkrit', address: 'Lot 5, Jalan Industri Puchong 2, 47100 Puchong, Selangor', incorporated: '2007-05-21', grade: 'G7', categories: 'B, CE', cover: 15_000_000, insurer: 'Allianz General Insurance Malaysia Berhad', bank: 'CIMB Bank Berhad',
    jobs: [{ title: 'Car park structure, Puchong', value: 8_500_000, score: 5, comment: 'Concrete works delivered to spec, ahead of schedule.', monthsAgo: 10 }, { title: 'Retaining wall, Bukit Jalil', value: 2_200_000, score: 4, comment: 'Solid work; documentation a little slow.', monthsAgo: 3 }] },
  { name: 'Mega Rangka Engineering Sdn Bhd', reg: '200501009876 (689876-A)', owner: 'Tan Chee Keong', slug: 'megarangka', address: 'No. 14, Jalan Tampoi 7, 81200 Johor Bahru, Johor', incorporated: '2005-02-11', grade: 'G7', categories: 'B, CE, ME', cover: 12_000_000, insurer: 'Etiqa General Insurance Berhad', bank: 'Public Bank Berhad' },
  { name: 'Perdana Cerucuk Sdn Bhd', reg: '201001034567 (901234-V)', owner: 'Mohd Hafiz bin Ismail', slug: 'perdanacerucuk', address: 'No. 9, Jalan Rasah Jaya, 70300 Seremban, Negeri Sembilan', incorporated: '2010-09-03', grade: 'G6', categories: 'CE', cover: 8_000_000, insurer: 'Tokio Marine Insurans (Malaysia) Berhad', bank: 'RHB Bank Berhad' },
  { name: 'Sinar Elektrik & Mekanikal Sdn Bhd', reg: '201401012233 (1081223-D)', owner: 'Priya Devi a/p Subramaniam', slug: 'sinarelektrik', address: 'Unit 3-2, Jalan Kuchai Maju 8, 58200 Kuala Lumpur', incorporated: '2014-04-17', grade: 'G5', categories: 'ME', cover: 4_000_000, insurer: 'AmGeneral Insurance Berhad', bank: 'Hong Leong Bank Berhad', flags: ['noIso'] },
  { name: 'Pantai Timur Builders Sdn Bhd', reg: '201201045511 (1004551-U)', owner: 'Wan Nurul Aisyah', slug: 'pantaitimur', address: 'No. 22, Jalan Gambut, 25000 Kuantan, Pahang', incorporated: '2012-12-05', grade: 'G6', categories: 'B, CE', cover: 5_000_000, insurer: 'Etiqa General Insurance Berhad', bank: 'Bank Islam Malaysia Berhad', flags: ['taxExpiring'] },
  { name: 'Utara Infra Sdn Bhd', reg: '200301027744 (612774-W)', owner: 'Lee Boon Hock', slug: 'utarainfra', address: 'No. 88, Jalan Bagan Luar, 12000 Butterworth, Pulau Pinang', incorporated: '2003-07-29', grade: 'G7', categories: 'B, CE, ME', cover: 20_000_000, insurer: 'Allianz General Insurance Malaysia Berhad', bank: 'Maybank Islamic Berhad',
    jobs: [{ title: 'Drainage upgrade, Seberang Perai', value: 9_800_000, score: 5, comment: 'Excellent traffic management and site safety.', monthsAgo: 16 }, { title: 'Logistics hub, Batu Kawan', value: 14_500_000, score: 4, comment: 'Strong delivery; one variation order disputed.', monthsAgo: 6 }] },
  { name: 'Kinabalu Teknik Sdn Bhd', reg: '201801003322 (1265332-M)', owner: 'Jeffrey Gimbang', slug: 'kinabaluteknik', address: 'Lot 7, Jalan Lintas, 88300 Kota Kinabalu, Sabah', incorporated: '2018-01-30', grade: 'G4', categories: 'B', cover: 2_000_000, insurer: 'Tokio Marine Insurans (Malaysia) Berhad', bank: 'CIMB Bank Berhad' },
  { name: 'Borneo Jambatan Sdn Bhd', reg: '200801056789 (825678-X)', owner: 'Alvin Ting Hui Ming', slug: 'borneojambatan', address: 'No. 31, Jalan Tun Jugah, 93350 Kuching, Sarawak', incorporated: '2008-10-14', grade: 'G7', categories: 'CE', cover: 10_000_000, insurer: 'AmGeneral Insurance Berhad', bank: 'Public Bank Berhad', flags: ['regMismatch'] },
  { name: 'Klang Valley Roofing Sdn Bhd', reg: '201901021144 (1331144-T)', owner: 'Muthu a/l Krishnan', slug: 'kvroofing', address: 'No. 4, Jalan Meru Jaya, 41050 Klang, Selangor', incorporated: '2019-06-12', grade: 'G3', categories: 'B', cover: 1_000_000, insurer: 'Etiqa General Insurance Berhad', bank: 'Maybank Islamic Berhad', flags: ['noIso', 'noBank'] },
  { name: 'Damai Aircond Services Sdn Bhd', reg: '201501038890 (1162889-H)', owner: 'Chong Mei Ling', slug: 'damaiaircond', address: 'No. 17, Jalan USJ 1/6, 47600 Subang Jaya, Selangor', incorporated: '2015-11-23', grade: 'G4', categories: 'ME', cover: 2_000_000, insurer: 'Allianz General Insurance Malaysia Berhad', bank: 'Hong Leong Bank Berhad', flags: ['plExpired'] },
  { name: 'Serba Guna Precast Sdn Bhd', reg: '200601041122 (741122-P)', owner: 'Zulkifli bin Hamzah', slug: 'serbagunaprecast', address: 'Lot 22, Kawasan Perindustrian Rawang, 48000 Rawang, Selangor', incorporated: '2006-08-08', grade: 'G6', categories: 'B, CE', cover: 6_000_000, insurer: 'Etiqa General Insurance Berhad', bank: 'RHB Bank Berhad',
    jobs: [{ title: 'Precast school blocks, Sungai Buloh', value: 5_400_000, score: 4, comment: 'Precast quality consistent; delivery windows tight but met.', monthsAgo: 8 }] },
  { name: 'Harmoni Interior Fitout Sdn Bhd', reg: '201701029988 (1243998-K)', owner: 'Nurul Huda binti Osman', slug: 'harmoniinterior', address: 'Level 5, Menara Bangsar, 59100 Kuala Lumpur', incorporated: '2017-08-15', grade: 'G5', categories: 'B', cover: 3_000_000, insurer: 'Tokio Marine Insurans (Malaysia) Berhad', bank: 'CIMB Bank Berhad' },
  { name: 'Ipoh Geotek Sdn Bhd', reg: '200901076655 (867655-A)', owner: 'Gan Siew Peng', slug: 'ipohgeotek', address: 'No. 12, Jalan Kuala Kangsar, 30010 Ipoh, Perak', incorporated: '2009-12-01', grade: 'G6', categories: 'CE', cover: 5_000_000, insurer: 'AmGeneral Insurance Berhad', bank: 'Public Bank Berhad', flags: ['nameMismatch'] },
  { name: 'Melaka Marin Works Sdn Bhd', reg: '201101052211 (952211-W)', owner: 'Hairul Nizam bin Yusof', slug: 'melakamarin', address: 'No. 6, Jalan Klebang Besar, 75200 Melaka', incorporated: '2011-03-19', grade: 'G6', categories: 'CE', cover: 7_000_000, insurer: 'Etiqa General Insurance Berhad', bank: 'Bank Islam Malaysia Berhad', flags: ['noBank'] },
  { name: 'Gemilang Paip & Saliran Sdn Bhd', reg: '201301067733 (1067733-V)', owner: 'Siti Rohani binti Kassim', slug: 'gemilangpaip', address: 'No. 40, Jalan Kebun Nenas, 40460 Shah Alam, Selangor', incorporated: '2013-10-02', grade: 'G5', categories: 'CE', cover: 5_000_000, insurer: 'Allianz General Insurance Malaysia Berhad', bank: 'Maybank Islamic Berhad',
    jobs: [{ title: 'Sewer reticulation, Kota Kemuning', value: 3_900_000, score: 5, comment: 'Zero rework on CCTV inspection.', monthsAgo: 12 }, { title: 'Stormwater culverts, Klang', value: 1_700_000, score: 4, comment: 'Good coordination with the local council.', monthsAgo: 2 }] },
  { name: 'Cergas Scaffolding Sdn Bhd', reg: '201601011177 (1179117-D)', owner: 'Ravi a/l Chandran', slug: 'cergasscaffolding', address: 'Lot 3, Jalan Semenyih Sentral, 43500 Semenyih, Selangor', incorporated: '2016-02-26', grade: 'G4', categories: 'B', cover: 3_000_000, insurer: 'Tokio Marine Insurans (Malaysia) Berhad', bank: 'RHB Bank Berhad', flags: ['cidbExpiring'] },
  { name: 'Andalas Jalan Raya Sdn Bhd', reg: '200401033300 (653300-H)', owner: 'Mohd Rizal bin Che Mat', slug: 'andalasjalan', address: 'No. 15, Jalan Sultan Yahya Petra, 15200 Kota Bharu, Kelantan', incorporated: '2004-06-10', grade: 'G7', categories: 'CE', cover: 10_000_000, insurer: 'AmGeneral Insurance Berhad', bank: 'Bank Islam Malaysia Berhad' },
  { name: 'Puncak Landskap Sdn Bhd', reg: '202001014466 (1371446-U)', owner: 'Farah Wahida binti Aziz', slug: 'puncaklandskap', address: 'No. 2, Jalan P9E/2, 62250 Putrajaya', incorporated: '2020-05-07', grade: 'G3', categories: 'B', cover: 1_000_000, insurer: 'Etiqa General Insurance Berhad', bank: 'Maybank Islamic Berhad', flags: ['noIso'] },
  { name: 'Indah Glazing Sdn Bhd', reg: '201001088123 (918812-T)', owner: 'Yap Kok Wai', slug: 'indahglazing', address: 'No. 25, Jalan SS 13/3, 47500 Petaling Jaya, Selangor', incorporated: '2010-11-11', grade: 'G5', categories: 'B', cover: 4_000_000, insurer: 'Allianz General Insurance Malaysia Berhad', bank: 'Hong Leong Bank Berhad',
    jobs: [{ title: 'Curtain wall replacement, Damansara', value: 2_800_000, score: 4, comment: 'Tidy installation; snag list closed quickly.', monthsAgo: 5 }] },
  { name: 'Setia Kukuh Construction Sdn Bhd', reg: '200801012020 (812020-M)', owner: 'Kamarul Ariffin bin Daud', slug: 'setiakukuh', address: 'No. 1, Persiaran Multimedia, 63000 Cyberjaya, Selangor', incorporated: '2008-01-22', grade: 'G7', categories: 'B, CE', cover: 8_000_000, insurer: 'Etiqa General Insurance Berhad', bank: 'CIMB Bank Berhad', flags: ['taxExpiring'],
    jobs: [{ title: 'Data centre shell, Cyberjaya', value: 11_200_000, score: 5, comment: 'Complex programme, delivered on time.', monthsAgo: 9 }] },
];

function toSpec(r: Row): SupplierSpec {
  const flags = new Set(r.flags ?? []);
  const digits = r.reg.slice(0, 12);
  const { ssm, cidb, pl, wc, tax, isoCert, bank } = docs;
  const list: DocSpec[] = [
    ssm(r.name, r.reg, r.address, r.incorporated),
    cidb(r.name, digits, r.grade, flags.has('cidbExpiring') ? monthsAhead(1) : monthsAhead(24), r.categories),
    pl(flags.has('nameMismatch') ? r.name.replace('Sdn Bhd', 'Enterprise') : r.name, String(r.cover), flags.has('plExpired') ? monthsAgo(2) : monthsAhead(18), r.insurer),
    wc(r.name, monthsAhead(15)),
    tax(r.name, flags.has('regMismatch') ? `${digits.slice(0, 6)}${String(Number(digits.slice(6)) + 1111).padStart(6, '0')}` : digits, flags.has('taxExpiring') ? monthsAhead(2) : monthsAhead(14)),
  ];
  if (!flags.has('noIso')) list.push(isoCert(r.name, monthsAhead(20)));
  if (!flags.has('noBank')) list.push(bank(r.name, digits, r.bank));
  return {
    name: r.name,
    registrationNo: r.reg,
    owner: { name: r.owner, email: `supplier@${r.slug}.local` },
    address: r.address,
    docs: list,
    pastJobs: r.jobs ?? [],
  };
}

run(() => ROWS.map(toSpec));
