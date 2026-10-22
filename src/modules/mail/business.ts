// AllDrive's contact details for customer emails. Same as the website's lib/site.ts (`site`);
// update both if they change.
export const business = {
  name: 'AllDrive Rent a Car Butuan',
  website: 'https://www.alldrivebutuan.com',
  email: 'alldrivebtc@gmail.com',
  phones: [
    { network: 'Smart', display: '0946 126 0177', href: '+639461260177' },
    { network: 'Globe', display: '0956 227 5764', href: '+639562275764' },
  ],
  whatsappNumber: '639461260177',
  messenger: 'https://m.me/alldriverentacarbutuan',
  address:
    'Brgy, P-5 Lower Doongan, Doongan, Butuan City, 8600 Agusan del Norte',
  directionsUrl:
    'https://www.google.com/maps/dir/?api=1&destination=AllDrive+Rent+a+Car+Butuan&destination_place_id=ChIJBUESUZzBATMRMZf6knQ5TZw',
} as const;

// What renters bring. Same as the website's booking form (lib/site.ts `rentalRequirements`).
export const requirements = {
  everyone: [
    'One valid government-issued ID (Student ID is not accepted)',
    '50% down payment to reserve the car, by GCash, Maya, bank transfer or cash',
  ],
  selfDrive: ["Valid driver's license"],
  withDriver: [
    "The driver's meals during the trip, and lodging on overnight trips, are shouldered by the renter",
  ],
} as const;
