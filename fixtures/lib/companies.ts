/** Fictional companies used by the demo. Nothing here refers to a real business. */
export interface Company {
  slug: string;
  name: string;
  newNo: string;
  oldNo: string;
  incorporated: string; // printed, absolute
  addressLines: string[];
  businessNature: string;
  directors: Array<{ name: string; since: string }>;
  cidbNo: string;
  grade: string;
  categories: string;
  taxRef: string;
  socsoCode: string;
  phone: string;
  email: string;
}

export const BINA_JAYA: Company = {
  slug: 'bina-jaya',
  name: 'Bina Jaya Sdn Bhd',
  newNo: '201501023456',
  oldNo: '1156789-K',
  incorporated: '15 June 2015',
  addressLines: ['No. 12, Jalan Industri 3/4', 'Taman Perindustrian Selatan', '43300 Seri Kembangan, Selangor'],
  businessNature: 'Civil engineering and building construction',
  directors: [
    { name: 'Ahmad Farid bin Zulkifli', since: '15/06/2015' },
    { name: 'Tan Mei Ling', since: '02/03/2018' },
  ],
  cidbNo: '0120150612-SL012345',
  grade: 'G5',
  categories: 'B, CE',
  taxRef: 'C 2034567890',
  socsoCode: 'B4300012345X',
  phone: '+60 3-8945 1234',
  email: 'admin@binajaya.example',
};

export const MEGA_WIRA: Company = {
  slug: 'mega-wira',
  name: 'Mega Wira Construction Sdn Bhd',
  newNo: '201801034567',
  oldNo: '1287654-A',
  incorporated: '22 February 2018',
  addressLines: ['Lot 8, Jalan Teknologi 5/2', 'Kota Kemuning Industrial Park', '40460 Shah Alam, Selangor'],
  businessNature: 'Building, civil and mechanical & electrical construction works',
  directors: [
    { name: 'Rajesh a/l Kumaran', since: '22/02/2018' },
    { name: 'Nurul Huda binti Rahman', since: '22/02/2018' },
    { name: 'Wong Kah Wai', since: '11/09/2021' },
  ],
  cidbNo: '0120180301-SL067890',
  grade: 'G7',
  categories: 'B, CE, ME',
  taxRef: 'C 2145678901',
  socsoCode: 'B4040067890A',
  phone: '+60 3-5121 9876',
  email: 'tender@megawira.example',
};
