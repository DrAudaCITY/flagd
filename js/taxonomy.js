// taxonomy.js — the category system.
//
// Four things are deliberately kept separate, because conflating them is what makes
// marketplaces impossible to extend later:
//
//   1. FLAG TYPE      what the person wants to do (service / sell / buy)
//   2. CATEGORY       what it is about (a stable id + an editable label)
//   3. CAPABILITY     what a business has explicitly opted into doing
//   4. FIELDS         what we ask about this category for this flag type
//
// Ids are stable and never derived from labels, so a label can be reworded without
// orphaning existing flags. Labels are the only thing the UI prints.

/* ================================================================ flag types */
export const FLAG_TYPES = {
  service: {
    id: 'service',
    pick: 'Get a service',
    pickHint: 'Someone comes and does work for you',
    label: 'I need a service',
    respond: 'Submit quote',
    respondShort: 'Quote',
    responseNoun: 'quote',
    responsePlural: 'quotes',
    feedLabel: 'Service requests',
    icon: '🔧',
  },
  sell: {
    id: 'sell',
    pick: 'Sell something',
    pickHint: 'Businesses bid to buy it from you',
    label: 'I want to sell',
    respond: 'Make purchase offer',
    respondShort: 'Offer',
    responseNoun: 'purchase offer',
    responsePlural: 'purchase offers',
    feedLabel: 'Items for sale',
    icon: '🏷️',
  },
  buy: {
    id: 'buy',
    pick: 'Buy something',
    pickHint: 'Businesses offer you matching stock',
    label: 'I want to buy',
    respond: 'Offer matching item',
    respondShort: 'Offer item',
    responseNoun: 'item offer',
    responsePlural: 'item offers',
    feedLabel: 'Buyers looking',
    icon: '🛒',
  },
  // Reserved. The engine already routes on type, so adding rentals later is a
  // catalog entry plus a field set — not a schema change.
  // rent: { ... properties, vehicles, tools, heavy equipment, venues ... }
};

export const flagType = (id) => FLAG_TYPES[id] || FLAG_TYPES.service;
export const FLAG_TYPE_ORDER = ['service', 'sell', 'buy'];

/* ================================================================ business types */
export const BUSINESS_TYPES = {
  service_provider: { id: 'service_provider', label: 'Service provider', hint: 'You do the work' },
  retailer:         { id: 'retailer',         label: 'Retailer',         hint: 'You sell new stock' },
  dealership:       { id: 'dealership',       label: 'Dealership',       hint: 'Vehicles, machinery, boats' },
  reseller:         { id: 'reseller',         label: 'Reseller',         hint: 'Used, refurbished or consignment' },
  buyer:            { id: 'buyer',            label: 'Professional buyer', hint: 'You acquire items to resell' },
  broker:           { id: 'broker',           label: 'Broker or intermediary', hint: 'You arrange the deal' },
};

/* ================================================================ service catalog
 * Parent groups from the master catalog. `subs` are [stableId, editableLabel].
 */
const S = (id, label, icon, color, synonyms, subs) => ({
  id: 'svc.' + id, label, icon, color, types: ['service'],
  synonyms: synonyms || [], enabled: true, markets: ['*'],
  subs: (subs || []).map(([sid, slabel]) => ({ id: 'svc.' + id + '.' + sid, label: slabel })),
});

export const SERVICE_CATALOG = [
  S('plumbing', 'Plumbing', '🔧', '#2e9bff', ['plumber', 'leak', 'drain', 'pipe', 'water heater'], [
    ['leaks', 'Leak repairs'], ['drains', 'Clogged drains'], ['toilets', 'Toilet repairs'],
    ['faucets', 'Faucet installation'], ['pipes', 'Pipe replacement'], ['water-heaters', 'Water heaters'],
    ['sewer', 'Sewer lines'], ['filtration', 'Water filtration'], ['pumps', 'Pumps'], ['septic', 'Septic service'],
  ]),
  S('electrical', 'Electrical', '⚡', '#f5a524', ['electrician', 'outlet', 'wiring', 'panel', 'ev charger'], [
    ['troubleshooting', 'Troubleshooting'], ['outlets', 'Outlets'], ['switches', 'Switches'],
    ['lighting', 'Lighting installation'], ['fans', 'Ceiling fans'], ['panels', 'Electrical panels'],
    ['rewiring', 'Rewiring'], ['surge', 'Surge protection'], ['generators', 'Generators'], ['ev', 'EV chargers'],
  ]),
  S('hvac', 'Air conditioning and heating', '❄️', '#17c3d6', ['ac', 'hvac', 'furnace', 'heat pump', 'aircon'], [
    ['ac-install', 'AC installation'], ['ac-repair', 'AC repair'], ['maintenance', 'Preventive maintenance'],
    ['furnace', 'Furnace service'], ['heat-pumps', 'Heat pumps'], ['ductwork', 'Ductwork'],
    ['duct-cleaning', 'Duct cleaning'], ['ventilation', 'Ventilation'], ['thermostats', 'Thermostats'],
  ]),
  S('handyman', 'Handyman and installation', '🔨', '#f97316', ['handyman', 'odd jobs', 'mounting', 'assembly'], [
    ['small-repairs', 'Small repairs'], ['assembly', 'Furniture assembly'], ['tv', 'TV mounting'],
    ['shelves', 'Shelves'], ['curtains', 'Curtain rods'], ['pictures', 'Picture hanging'],
    ['doors', 'Door adjustments'], ['caulking', 'Caulking'], ['grab-bars', 'Accessibility grab bars'],
  ]),
  S('appliance-repair', 'Appliance repair', '🧰', '#06b6d4', ['fridge', 'washer', 'dryer', 'dishwasher', 'oven'], [
    ['refrigerators', 'Refrigerators'], ['freezers', 'Freezers'], ['washers', 'Washing machines'],
    ['dryers', 'Dryers'], ['dishwashers', 'Dishwashers'], ['ovens', 'Ovens'], ['stoves', 'Stoves'],
    ['microwaves', 'Microwaves'], ['install', 'Appliance installation'],
  ]),
  S('construction', 'General construction and remodeling', '🏗️', '#a16207', ['remodel', 'renovation', 'contractor', 'addition'], [
    ['additions', 'Home additions'], ['kitchen', 'Kitchen remodeling'], ['bathroom', 'Bathroom remodeling'],
    ['whole-home', 'Whole-home renovation'], ['commercial', 'Commercial buildouts'], ['garages', 'Garages'],
    ['sheds', 'Sheds'], ['management', 'Construction management'],
  ]),
  S('roofing', 'Roofing and waterproofing', '🏠', '#ef4444', ['roof', 'gutter', 'leak', 'shingles'], [
    ['repairs', 'Roof repairs'], ['replacement', 'Replacement'], ['inspections', 'Inspections'],
    ['flat', 'Flat roofing'], ['coatings', 'Roof coatings'], ['flashing', 'Flashing'],
    ['skylights', 'Skylights'], ['waterproofing', 'Waterproofing'], ['gutters', 'Gutters'],
  ]),
  S('masonry', 'Masonry, concrete and paving', '🧱', '#78716c', ['concrete', 'driveway', 'brick', 'paving'], [
    ['brick', 'Brickwork'], ['stone', 'Stonework'], ['foundations', 'Foundations'], ['slabs', 'Concrete slabs'],
    ['driveways', 'Driveways'], ['sidewalks', 'Sidewalks'], ['pavers', 'Pavers'],
    ['retaining', 'Retaining walls'], ['asphalt', 'Asphalt repair'],
  ]),
  S('carpentry', 'Carpentry and woodworking', '🪚', '#b45309', ['carpenter', 'cabinets', 'deck', 'trim'], [
    ['framing', 'Framing'], ['finish', 'Finish carpentry'], ['trim', 'Trim'], ['cabinets', 'Custom cabinets'],
    ['closets', 'Closets'], ['shelving', 'Shelving'], ['doors', 'Doors'], ['decks', 'Decks'],
    ['restoration', 'Furniture restoration'],
  ]),
  S('painting', 'Painting and wall finishes', '🎨', '#ec4899', ['painter', 'drywall', 'wallpaper'], [
    ['interior', 'Interior painting'], ['exterior', 'Exterior painting'], ['commercial', 'Commercial painting'],
    ['wallpaper', 'Wallpaper installation and removal'], ['drywall', 'Drywall repair'],
    ['plaster', 'Plaster'], ['textured', 'Textured finishes'],
  ]),
  S('flooring', 'Flooring, tile and stone', '🪵', '#92400e', ['tile', 'hardwood', 'carpet', 'countertop', 'quartzite', 'granite', 'slab'], [
    ['tile', 'Tile installation'], ['hardwood', 'Hardwood'], ['laminate', 'Laminate'], ['vinyl', 'Vinyl'],
    ['carpet', 'Carpet'], ['refinishing', 'Floor refinishing'], ['grout', 'Grout repair'],
    ['stone-restoration', 'Stone restoration'], ['countertops', 'Countertop fabrication and installation'],
  ]),
  S('windows-doors', 'Windows, doors and glass', '🪟', '#0ea5e9', ['glass', 'window', 'garage door', 'blinds'], [
    ['window-replacement', 'Window replacement'], ['glass-repair', 'Glass repairs'], ['shower', 'Shower enclosures'],
    ['mirrors', 'Mirrors'], ['screens', 'Screens'], ['shutters', 'Shutters'], ['blinds', 'Blinds'],
    ['garage-doors', 'Garage doors'], ['storefront', 'Storefront glass'],
  ]),
  S('metalwork', 'Metalwork, fences and gates', '🔩', '#64748b', ['welding', 'fence', 'gate', 'railing'], [
    ['welding', 'Welding'], ['fabrication', 'Fabrication'], ['railings', 'Railings'], ['stairs', 'Metal stairs'],
    ['fencing', 'Fencing'], ['gates', 'Automatic gates'], ['structural', 'Structural metal repairs'],
  ]),
  S('cleaning', 'Cleaning', '🧽', '#a855f7', ['cleaner', 'housekeeping', 'maid', 'pressure washing'], [
    ['recurring', 'Recurring house cleaning'], ['deep', 'Deep cleaning'], ['move', 'Move-in / move-out cleaning'],
    ['office', 'Office cleaning'], ['post-construction', 'Post-construction cleaning'], ['windows', 'Windows'],
    ['carpets', 'Carpets'], ['upholstery', 'Upholstery'], ['pressure-washing', 'Pressure washing'],
  ]),
  S('laundry', 'Laundry and clothing care', '👕', '#38bdf8', ['dry cleaning', 'ironing', 'wash and fold'], [
    ['wash-fold', 'Wash-and-fold'], ['ironing', 'Ironing'], ['dry-cleaning', 'Dry cleaning pickup'],
    ['shoes', 'Shoe cleaning'], ['leather', 'Leather cleaning'], ['wedding', 'Wedding dress cleaning'],
  ]),
  S('pest', 'Pest control', '🐜', '#84cc16', ['exterminator', 'termites', 'rodents', 'bedbugs'], [
    ['insects', 'General insects'], ['termites', 'Termites'], ['rodents', 'Rodents'], ['mosquitoes', 'Mosquitoes'],
    ['bedbugs', 'Bedbugs'], ['wildlife', 'Wildlife removal'], ['exclusion', 'Exclusion and prevention'],
  ]),
  S('restoration', 'Restoration and remediation', '💧', '#0891b2', ['water damage', 'mold', 'fire damage'], [
    ['water', 'Water damage'], ['fire', 'Fire and smoke damage'], ['mold', 'Mold remediation'],
    ['storm', 'Storm cleanup'], ['odor', 'Odor removal'], ['hazmat', 'Specialist hazardous-material removal'],
  ]),
  S('landscaping', 'Landscaping and gardening', '🌿', '#22c55e', ['lawn', 'mowing', 'tree', 'garden', 'irrigation'], [
    ['mowing', 'Lawn mowing'], ['maintenance', 'Garden maintenance'], ['design', 'Landscape design'],
    ['planting', 'Planting'], ['sod', 'Sod'], ['fertilization', 'Fertilization'], ['irrigation', 'Irrigation'],
    ['drainage', 'Drainage'], ['tree', 'Tree pruning and removal'], ['stump', 'Stump grinding'],
  ]),
  S('pools', 'Pools, spas and water features', '🏊', '#06b6d4', ['pool', 'hot tub', 'spa'], [
    ['cleaning', 'Pool cleaning'], ['equipment', 'Equipment repair'], ['construction', 'Pool construction'],
    ['resurfacing', 'Resurfacing'], ['leak', 'Leak detection'], ['hot-tub', 'Hot tub service'],
    ['ponds', 'Pond and fountain maintenance'],
  ]),
  S('organization', 'Home organization and property care', '🗂️', '#f59e0b', ['organizer', 'declutter', 'staging'], [
    ['decluttering', 'Decluttering'], ['closets', 'Closet organization'], ['packing', 'Packing assistance'],
    ['staging', 'Home staging'], ['house-sitting', 'House sitting'], ['vacant', 'Vacant-property checks'],
    ['seasonal', 'Seasonal home preparation'],
  ]),
  S('moving', 'Moving, hauling and storage', '📦', '#8b5cf6', ['movers', 'junk removal', 'hauling', 'storage'], [
    ['local', 'Local moving'], ['long-distance', 'Long-distance moving'], ['labor', 'Loading and unloading'],
    ['furniture-delivery', 'Furniture delivery'], ['piano', 'Piano moving'], ['packing', 'Packing'],
    ['storage', 'Storage'], ['junk', 'Junk removal'], ['estate', 'Estate cleanouts'],
  ]),
  S('security', 'Security and smart home', '🔐', '#475569', ['locksmith', 'alarm', 'camera', 'smart home'], [
    ['locksmith', 'Locksmiths'], ['locks', 'Locks'], ['alarms', 'Alarms'], ['cameras', 'Cameras'],
    ['access', 'Access control'], ['intercom', 'Intercoms'], ['smart-lighting', 'Smart lighting'],
    ['automation', 'Home automation'], ['theater', 'Home theater installation'],
  ]),
  S('energy', 'Energy and utilities', '🔋', '#eab308', ['solar', 'generator', 'insulation', 'battery'], [
    ['solar', 'Solar installation and maintenance'], ['battery', 'Battery backup'], ['insulation', 'Insulation'],
    ['assessments', 'Energy assessments'], ['generator', 'Generator service'], ['well-pumps', 'Well pumps'],
    ['rainwater', 'Rainwater systems'],
  ]),
  S('design-engineering', 'Architecture, engineering and surveying', '📐', '#6366f1', ['architect', 'engineer', 'survey', 'drafting'], [
    ['architecture', 'Architectural design'], ['interior', 'Interior design'], ['structural', 'Structural engineering'],
    ['civil', 'Civil engineering'], ['surveying', 'Land surveying'], ['drafting', 'Drafting'],
    ['soil', 'Soil testing'], ['estimating', 'Project estimating'],
  ]),
  S('inspection', 'Property inspection and management', '🔍', '#0d9488', ['inspection', 'property management', 'appraisal'], [
    ['home', 'Home inspections'], ['pest', 'Pest inspections'], ['management', 'Property management'],
    ['turnovers', 'Rental turnovers'], ['coordination', 'Maintenance coordination'],
    ['photography', 'Property photography'], ['appraisal', 'Appraisal services'],
  ]),

  S('auto-repair', 'Automotive repair and maintenance', '🔩', '#64748b', ['mechanic', 'brakes', 'oil change', 'tires'], [
    ['mechanics', 'Mechanics'], ['mobile', 'Mobile mechanics'], ['oil', 'Oil changes'], ['brakes', 'Brakes'],
    ['suspension', 'Suspension'], ['diagnostics', 'Diagnostics'], ['batteries', 'Batteries'], ['tires', 'Tires'],
    ['alignment', 'Alignment'], ['ac', 'AC repair'], ['inspections', 'Vehicle inspections'],
  ]),
  S('auto-appearance', 'Automotive appearance and accessories', '🚿', '#0ea5e9', ['detailing', 'tint', 'wrap', 'body shop'], [
    ['wash', 'Car washing'], ['detailing', 'Detailing'], ['paint-correction', 'Paint correction'],
    ['ceramic', 'Ceramic coatings'], ['bodywork', 'Bodywork'], ['dent', 'Dent repair'],
    ['repainting', 'Repainting'], ['tinting', 'Tinting'], ['upholstery', 'Upholstery'],
    ['audio', 'Audio'], ['wraps', 'Wraps'],
  ]),
  S('vehicle-assistance', 'Vehicle assistance and transport', '🚛', '#f97316', ['towing', 'roadside', 'shipping'], [
    ['towing', 'Towing'], ['roadside', 'Roadside assistance'], ['jump', 'Jump-starts'], ['lockouts', 'Lockouts'],
    ['shipping', 'Vehicle shipping'], ['designated', 'Designated drivers'], ['chauffeur', 'Chauffeur services'],
  ]),
  S('recreational-vehicles', 'Motorcycles, boats, RVs and bicycles', '🏍️', '#7c3aed', ['motorcycle', 'boat', 'rv', 'bike'], [
    ['repair', 'Repair'], ['maintenance', 'Maintenance'], ['detailing', 'Detailing'],
    ['winterization', 'Winterization'], ['storage-prep', 'Storage preparation'],
    ['accessories', 'Accessory installation'], ['bicycle', 'Bicycle assembly and tuning'],
  ]),

  S('device-repair', 'Computers, phones and electronics', '💻', '#6366f1', ['computer repair', 'phone repair', 'data recovery'], [
    ['computer', 'Computer repair'], ['phone', 'Phone repair'], ['tablet', 'Tablet repair'],
    ['console', 'Console repair'], ['data', 'Data recovery'], ['setup', 'Device setup'],
    ['wifi', 'Wi-Fi troubleshooting'], ['printer', 'Printer repair'],
  ]),
  S('business-it', 'Business IT', '🖧', '#0284c7', ['network', 'it support', 'cybersecurity', 'pos'], [
    ['network', 'Network installation'], ['support', 'IT support'], ['cloud', 'Cloud setup'],
    ['security', 'Cybersecurity services'], ['servers', 'Server administration'],
    ['software', 'Business software implementation'], ['pos', 'Point-of-sale setup'],
  ]),
  S('software', 'Software and digital products', '⌨️', '#4f46e5', ['website', 'app', 'ecommerce', 'automation'], [
    ['websites', 'Websites'], ['apps', 'Mobile apps'], ['ecommerce', 'Ecommerce stores'],
    ['integrations', 'Integrations'], ['automation', 'Automation'], ['ai', 'AI workflow setup'],
    ['maintenance', 'Software maintenance'], ['testing', 'Testing'],
  ]),
  S('marketing', 'Design, marketing and content', '📣', '#db2777', ['logo', 'seo', 'ads', 'video', 'branding'], [
    ['logos', 'Logos'], ['graphic', 'Graphic design'], ['branding', 'Branding'], ['social', 'Social media'],
    ['seo', 'SEO'], ['ads', 'Paid advertising'], ['copywriting', 'Copywriting'], ['video', 'Video editing'],
    ['animation', 'Animation'], ['product-photo', 'Product photography'], ['strategy', 'Marketing strategy'],
  ]),
  S('admin-support', 'Administrative and business support', '🗃️', '#0f766e', ['virtual assistant', 'data entry', 'translation'], [
    ['va', 'Virtual assistants'], ['data-entry', 'Data entry'], ['support', 'Customer support'],
    ['transcription', 'Transcription'], ['translation', 'Translation'], ['interpretation', 'Interpretation'],
    ['research', 'Research'], ['formatting', 'Document formatting'],
  ]),
  S('accounting', 'Accounting and business advisory', '📊', '#15803d', ['bookkeeping', 'tax', 'payroll', 'consulting'], [
    ['bookkeeping', 'Bookkeeping'], ['payroll', 'Payroll'], ['tax', 'Tax preparation'], ['accounting', 'Accounting'],
    ['business-plans', 'Business plans'], ['operations', 'Operational consulting'], ['hr', 'HR consulting'],
    ['recruiting', 'Recruiting'],
  ]),
  S('legal-financial', 'Legal, insurance and financial professionals', '⚖️', '#334155', ['lawyer', 'notary', 'insurance', 'mortgage'], [
    ['consultations', 'Legal consultations'], ['contracts', 'Contract work'], ['notary', 'Notarial services'],
    ['insurance', 'Insurance quotes'], ['mortgage', 'Mortgage brokers'], ['financial', 'Financial planning'],
  ]),

  S('education', 'Education and lessons', '📚', '#2563eb', ['tutor', 'lessons', 'language', 'music'], [
    ['tutoring', 'School tutoring'], ['languages', 'Languages'], ['test-prep', 'Test preparation'],
    ['music', 'Music lessons'], ['coding', 'Coding'], ['art', 'Art'], ['photography', 'Photography'],
    ['cooking', 'Cooking'], ['driving', 'Driving instruction'], ['professional', 'Professional training'],
  ]),
  S('beauty', 'Beauty and personal care', '💇', '#e11d48', ['hair', 'nails', 'makeup', 'barber'], [
    ['haircuts', 'Haircuts'], ['styling', 'Styling'], ['coloring', 'Coloring'], ['barbering', 'Barbering'],
    ['nails', 'Nails'], ['makeup', 'Makeup'], ['lashes', 'Lashes'], ['brows', 'Brows'],
    ['waxing', 'Waxing'], ['skincare', 'Skincare'], ['bridal', 'Bridal beauty'],
  ]),
  S('fitness', 'Fitness and wellness', '🏋️', '#16a34a', ['personal trainer', 'yoga', 'massage', 'nutrition'], [
    ['training', 'Personal training'], ['yoga', 'Yoga'], ['pilates', 'Pilates'], ['sports', 'Sports coaching'],
    ['dance', 'Dance'], ['massage', 'Massage'], ['nutrition', 'Nutrition consultations'],
    ['workplace', 'Workplace wellness'],
  ]),
  S('care', 'Care and family support', '🤝', '#be123c', ['babysitter', 'nanny', 'elder care', 'nursing'], [
    ['babysitting', 'Babysitting'], ['nannies', 'Nannies'], ['elder', 'Elder companionship'],
    ['respite', 'Respite care'], ['disability', 'Disability support'], ['postpartum', 'Postpartum support'],
    ['nursing', 'Home nursing'],
  ]),
  S('pets', 'Pet services', '🐕', '#c2410c', ['dog walking', 'grooming', 'pet sitting', 'vet'], [
    ['walking', 'Dog walking'], ['sitting', 'Pet sitting'], ['boarding', 'Boarding'], ['grooming', 'Grooming'],
    ['training', 'Training'], ['transport', 'Pet transportation'], ['aquarium', 'Aquarium maintenance'],
    ['vet', 'Veterinary home visits'],
  ]),
  S('events', 'Events and entertainment', '🎉', '#9333ea', ['wedding', 'dj', 'photographer', 'party'], [
    ['planning', 'Event planning'], ['wedding', 'Wedding planning'], ['dj', 'DJs'], ['bands', 'Bands'],
    ['entertainers', 'Entertainers'], ['mc', 'MCs'], ['photography', 'Photography'], ['video', 'Videography'],
    ['decor', 'Decorations'], ['floral', 'Floral arrangements'], ['staffing', 'Event staffing'],
  ]),
  S('food', 'Food and hospitality', '🍽️', '#ea580c', ['catering', 'chef', 'cake', 'bartender', 'bbq'], [
    ['catering', 'Catering'], ['chef', 'Private chefs'], ['meal-prep', 'Meal preparation'], ['cakes', 'Cakes'],
    ['desserts', 'Desserts'], ['bartenders', 'Bartenders'], ['food-trucks', 'Food trucks'],
    ['bbq', 'Barbecue services'], ['event-cooking', 'Cooking for events'],
  ]),
  S('delivery', 'Delivery and errands', '🛵', '#0891b2', ['courier', 'errands', 'personal shopper'], [
    ['courier', 'Courier services'], ['grocery', 'Grocery pickup'], ['shopping', 'Personal shopping'],
    ['parcel', 'Parcel delivery'], ['documents', 'Document delivery'], ['business', 'Business deliveries'],
    ['errands', 'Errands'],
  ]),
  S('crafts', 'Clothing and specialist crafts', '🧵', '#a21caf', ['tailor', 'alterations', 'upholstery', 'watch repair'], [
    ['alterations', 'Alterations'], ['tailoring', 'Tailoring'], ['dressmaking', 'Dressmaking'],
    ['embroidery', 'Embroidery'], ['upholstery', 'Upholstery'], ['leather', 'Leather repair'],
    ['shoes', 'Shoe repair'], ['watches', 'Watch repair'], ['jewelry', 'Jewelry repair'],
  ]),

  S('commercial-industrial', 'Commercial and industrial services', '🏭', '#57534e', ['commercial refrigeration', 'machinery', 'signage'], [
    ['refrigeration', 'Commercial refrigeration'], ['restaurant-equipment', 'Restaurant equipment repair'],
    ['machinery', 'Machinery maintenance'], ['forklift', 'Forklift service'],
    ['industrial-cleaning', 'Industrial cleaning'], ['signage', 'Signage'], ['printing', 'Printing'],
    ['packaging', 'Packaging'],
  ]),
  S('agriculture', 'Agriculture and rural property', '🚜', '#65a30d', ['tractor', 'land clearing', 'livestock', 'barn'], [
    ['tractor', 'Tractor work'], ['clearing', 'Land clearing'], ['brush', 'Brush cutting'], ['fencing', 'Fencing'],
    ['irrigation', 'Irrigation'], ['equipment', 'Equipment repair'], ['soil', 'Soil preparation'],
    ['livestock', 'Livestock care'], ['barn', 'Barn maintenance'],
  ]),
];

/* ================================================================ item catalog
 * Shared by BUY and SELL — the same taxonomy, never duplicated.
 * `buyers` are the business types plausibly interested in acquiring; they are a
 * seeding hint for capability suggestions, never an automatic entitlement.
 */
const I = (id, label, icon, color, buyers, synonyms, subs) => ({
  id: 'item.' + id, label, icon, color, types: ['buy', 'sell'],
  buyers: buyers || [], synonyms: synonyms || [], enabled: true, markets: ['*'],
  subs: (subs || []).map(([sid, slabel]) => ({ id: 'item.' + id + '.' + sid, label: slabel })),
});

export const ITEM_CATALOG = [
  I('cars', 'Cars and pickup trucks', '🚙', '#0ea5e9',
    ['Used car dealerships', 'Vehicle purchasing companies', 'Auto brokers'],
    ['car', 'truck', 'sedan', 'suv', 'pickup', 'vehicle'], []),
  I('damaged-vehicles', 'Damaged or nonrunning vehicles', '🚧', '#b91c1c',
    ['Salvage buyers', 'Dismantlers', 'Parts recyclers', 'Rebuilders'],
    ['salvage', 'junk car', 'wrecked', 'not running'], []),
  I('motorcycles', 'Motorcycles, scooters and ATVs', '🏍️', '#7c3aed',
    ['Motorcycle dealerships', 'Powersports dealers', 'Specialist resellers'],
    ['motorcycle', 'scooter', 'atv', 'quad'], []),
  I('boats', 'Boats and watercraft', '⛵', '#0284c7',
    ['Boat dealers', 'Marine brokers', 'Specialist buyers'],
    ['boat', 'jet ski', 'watercraft'], []),
  I('rvs', 'RVs, campers and trailers', '🚐', '#7c2d12',
    ['RV dealerships', 'Trailer dealers', 'Consignment businesses'],
    ['rv', 'camper', 'trailer', 'motorhome'], []),
  I('commercial-trucks', 'Commercial trucks and fleet vehicles', '🚚', '#475569',
    ['Commercial vehicle dealers', 'Fleet buyers', 'Auction businesses'],
    ['box truck', 'semi', 'fleet', 'van'], []),
  I('heavy-machinery', 'Heavy machinery and farm equipment', '🚜', '#65a30d',
    ['Equipment dealers', 'Machinery brokers', 'Auctioneers'],
    ['excavator', 'tractor', 'backhoe', 'skid steer'], []),
  I('bicycles', 'Bicycles and electric bikes', '🚲', '#16a34a',
    ['Bike shops', 'Refurbishers', 'Used bicycle dealers'],
    ['bike', 'ebike', 'bicycle'], []),
  I('computers', 'Phones, tablets and computers', '💻', '#6366f1',
    ['Electronics buyback businesses', 'Repair shops', 'Refurbishers'],
    ['iphone', 'laptop', 'macbook', 'android', 'ipad', 'pc'], []),
  I('gaming', 'Gaming consoles and video games', '🎮', '#7e22ce',
    ['Game stores', 'Electronics resellers', 'Specialist collectibles businesses'],
    ['playstation', 'xbox', 'nintendo', 'switch'], []),
  I('av-gear', 'TVs, cameras, audio equipment and drones', '📷', '#1d4ed8',
    ['Used electronics dealers', 'Camera shops', 'Specialist resellers'],
    ['tv', 'camera', 'lens', 'speaker', 'drone', 'stereo'], []),
  I('appliances', 'Home appliances', '🧊', '#06b6d4',
    ['Used appliance stores', 'Appliance refurbishers', 'Parts buyers'],
    ['fridge', 'refrigerator', 'washer', 'dryer', 'stove', 'dishwasher'], []),
  I('furniture', 'Furniture and home decor', '🛋️', '#d97706',
    ['Secondhand furniture stores', 'Consignment shops', 'Antique dealers'],
    ['sofa', 'couch', 'table', 'bed', 'dresser'], []),
  I('luxury-furniture', 'Luxury furniture and designer pieces', '🪑', '#a16207',
    ['Design consignment businesses', 'Specialist dealers'],
    ['designer', 'herman miller', 'eames', 'mid century'], []),
  I('jewelry', 'Jewelry, watches and precious metals', '💍', '#ca8a04',
    ['Jewelers', 'Watch dealers', 'Precious metal buyers', 'Pawnshops'],
    ['gold', 'silver', 'diamond', 'rolex', 'watch'], []),
  I('fashion', 'Clothing, shoes, handbags and accessories', '👜', '#be185d',
    ['Consignment stores', 'Vintage shops', 'Luxury resale businesses'],
    ['designer bag', 'sneakers', 'vintage', 'handbag'], []),
  I('baby', "Baby and children's equipment", '🍼', '#f472b6',
    ["Children's resale stores", 'Specialist secondhand retailers'],
    ['stroller', 'car seat', 'crib', 'high chair'], []),
  I('tools', 'Tools and workshop equipment', '🛠️', '#78716c',
    ['Tool resellers', 'Equipment dealers', 'Pawnshops'],
    ['dewalt', 'milwaukee', 'table saw', 'compressor'], []),
  I('sports', 'Sports and exercise equipment', '🏋️', '#16a34a',
    ['Sporting goods resellers', 'Gym equipment dealers'],
    ['treadmill', 'peloton', 'weights', 'golf clubs'], []),
  I('instruments', 'Musical instruments', '🎸', '#9333ea',
    ['Music shops', 'Instrument dealers', 'Repair and resale businesses'],
    ['guitar', 'piano', 'drums', 'violin'], []),
  I('art-antiques', 'Art, antiques, collectibles and memorabilia', '🖼️', '#b45309',
    ['Galleries', 'Antique dealers', 'Auction houses', 'Specialist buyers'],
    ['painting', 'antique', 'collectible', 'memorabilia'], []),
  I('media', 'Books, comics, records and physical media', '📀', '#4338ca',
    ['Used bookstores', 'Comic shops', 'Record stores', 'Collectibles dealers'],
    ['vinyl', 'records', 'comics', 'books', 'dvd'], []),
  I('building-materials', 'Building materials and renovation leftovers', '🧱', '#92400e',
    ['Architectural salvage stores', 'Surplus dealers', 'Material resellers'],
    ['lumber', 'tile', 'slab', 'quartzite', 'granite', 'surplus', 'salvage'], []),
  I('restaurant-equipment', 'Restaurant and commercial kitchen equipment', '🍳', '#ea580c',
    ['Restaurant equipment dealers', 'Liquidators'],
    ['walk-in', 'fryer', 'commercial oven', 'prep table'], []),
  I('office', 'Office furniture and business electronics', '🏢', '#0f766e',
    ['Office liquidators', 'Used furniture dealers', 'IT asset buyers'],
    ['desks', 'cubicles', 'office chairs', 'servers'], []),
  I('retail-inventory', 'Excess retail inventory', '📦', '#8b5cf6',
    ['Wholesale buyers', 'Stock liquidators', 'Discount retailers'],
    ['overstock', 'closeout', 'wholesale lot'], []),
  I('scrap', 'Scrap metal and recyclable materials', '♻️', '#57534e',
    ['Scrap dealers', 'Material recovery businesses'],
    ['copper', 'aluminum', 'scrap', 'recycling'], []),
  I('estate', 'Entire household or estate contents', '🏚️', '#a16207',
    ['Estate sale companies', 'Auctioneers', 'Bulk buyers', 'Liquidators'],
    ['estate sale', 'clearout', 'whole house', 'downsizing'], []),
  I('property', 'Houses, apartments and commercial property', '🏘️', '#0369a1',
    ['Real estate brokers', 'Professional property buyers', 'Investors'],
    ['house', 'apartment', 'condo', 'commercial building'], []),
  I('land', 'Land and rural property', '🌄', '#4d7c0f',
    ['Land brokers', 'Developers', 'Agricultural buyers'],
    ['acreage', 'lot', 'farm', 'ranch'], []),
  I('business-assets', 'Operating businesses or business assets', '🏪', '#334155',
    ['Business brokers', 'Acquisition buyers', 'Asset liquidators'],
    ['business for sale', 'assets', 'franchise'], []),
];

/* The escape hatch. Demand recorded here is what tells you which category to add next. */
export const OTHER_CATEGORY = {
  id: 'other', label: 'Other / not listed', icon: '🏷️', color: '#94a3b8',
  types: ['service', 'sell', 'buy'], synonyms: ['something else', 'not listed'],
  enabled: true, markets: ['*'], subs: [], needsDescription: true,
};

/* ================================================================ index */
const ALL = SERVICE_CATALOG.concat(ITEM_CATALOG).concat([OTHER_CATEGORY]);
const BY_ID = new Map();
ALL.forEach(p => {
  BY_ID.set(p.id, p);
  p.subs.forEach(s => BY_ID.set(s.id, Object.assign({ parent: p.id, types: p.types }, s)));
});

export const allParents = () => ALL;
export const nodeById = (id) => BY_ID.get(id) || null;
export const parentOf = (id) => {
  const n = BY_ID.get(id);
  if (!n) return null;
  return n.parent ? BY_ID.get(n.parent) : n;
};
export const subsOf = (id) => (BY_ID.get(id) || {}).subs || [];

/** Parent categories that accept this flag type, in the active market. */
export const parentsFor = (type, market) =>
  ALL.filter(p => p.types.includes(type) && isEnabled(p.id, market));

/** Label path for display: "Plumbing · Water heaters". */
export function labelPath(id) {
  const n = BY_ID.get(id);
  if (!n) return '';
  const p = n.parent ? BY_ID.get(n.parent) : null;
  return p ? `${p.label} · ${n.label}` : n.label;
}

/* ================================================================ activation
 * Categories can be switched off globally or limited to specific launch markets.
 * Overrides are read from the store so an operator can change them without a deploy.
 */
let overrides = {};                       // { [categoryId]: { enabled, markets } }
let activeMarket = '*';

export function configureTaxonomy(opts = {}) {
  if (opts.overrides) overrides = opts.overrides;
  if (opts.market) activeMarket = opts.market;
}
export const getMarket = () => activeMarket;

export function isEnabled(id, market) {
  const n = BY_ID.get(id);
  if (!n) return false;
  const o = overrides[id] || {};
  const enabled = o.enabled !== undefined ? o.enabled : n.enabled;
  if (!enabled) return false;
  const markets = o.markets || n.markets || ['*'];
  const m = market || activeMarket;
  return markets.includes('*') || m === '*' || markets.includes(m);
}

/** The initial launch set from the brief. Everything else is seeded but switched off. */
export const LAUNCH_CATEGORIES = [
  'svc.plumbing', 'svc.electrical', 'svc.hvac', 'svc.handyman', 'svc.appliance-repair',
  'svc.cleaning', 'svc.landscaping', 'svc.pools', 'svc.pest',
  'svc.moving', 'svc.auto-repair', 'svc.auto-appearance', 'svc.device-repair',
  'item.cars', 'item.furniture', 'item.appliances', 'item.computers', 'item.gaming',
  'item.estate', 'item.tools',
  'other',
];

/** Build the override map that leaves only the launch set enabled. */
export function launchOnlyOverrides() {
  const out = {};
  ALL.forEach(p => { if (!LAUNCH_CATEGORIES.includes(p.id)) out[p.id] = { enabled: false }; });
  return out;
}

/* ================================================================ migration
 * The prototype shipped 17 flat categories with a binary service/item kind.
 * This maps them onto stable taxonomy ids so existing flags, bids and pro
 * profiles keep working. Legacy `item` flags were all "wanted" posts, so they
 * migrate to the buy type.
 */
export const LEGACY_CATEGORY_MAP = {
  plumber: 'svc.plumbing',
  electrician: 'svc.electrical',
  hvac: 'svc.hvac',
  handyman: 'svc.handyman',
  roofer: 'svc.roofing',
  landscaper: 'svc.landscaping',
  cleaner: 'svc.cleaning',
  mover: 'svc.moving',
  painter: 'svc.painting',
  pest: 'svc.pest',
  appliance: 'svc.appliance-repair',
  autoshop: 'svc.auto-repair',
  usedcar: 'item.cars',
  furniture: 'item.furniture',
  electronics: 'item.computers',
  tools: 'item.tools',
  other: 'other',
};

/** Legacy category id -> { categoryId, type }. Idempotent and safe to re-run. */
export function migrateLegacyCategory(legacyId) {
  const categoryId = LEGACY_CATEGORY_MAP[legacyId] || 'other';
  const node = BY_ID.get(categoryId);
  const type = node && node.types.includes('service') ? 'service' : 'buy';
  return { categoryId, type };
}

/* ================================================================ search */
const norm = (s) => String(s || '').toLowerCase().trim();

/**
 * Progressive-disclosure search: matches label, synonyms and subcategory labels.
 * Returns parents, each with the subcategories that matched (if any).
 */
export function searchCategories(query, type, market) {
  const q = norm(query);
  const pool = parentsFor(type, market);
  if (!q) return pool.map(p => ({ node: p, subs: [], score: 0 }));

  const out = [];
  pool.forEach(p => {
    const label = norm(p.label);
    let score = 0;
    // An exact synonym hit outranks a prefix match on some unrelated label —
    // otherwise typing "ac" surfaces Accounting ahead of Air conditioning.
    if (label === q) score = 120;
    else if (p.synonyms.some(s => norm(s) === q)) score = 110;
    else if (label.startsWith(q)) score = 100;
    else if (label.includes(q)) score = 70;
    if (score < 100 && p.synonyms.some(s => norm(s).startsWith(q))) score = Math.max(score, 85);
    else if (p.synonyms.some(s => norm(s).includes(q))) score = Math.max(score, 55);

    const subs = p.subs.filter(s => norm(s.label).includes(q));
    if (subs.length) score = Math.max(score, 80);

    if (score > 0) out.push({ node: p, subs, score });
  });
  return out.sort((a, b) => b.score - a.score || a.node.label.localeCompare(b.node.label));
}

/* ================================================================ field sets
 * What we ask, per flag type. Base fields apply to every category; `extra` is
 * category-specific. Kept declarative so forms are generated, not hand-written.
 */
export const BASE_FIELDS = {
  service: [
    { id: 'title', label: 'One-line summary', type: 'text', required: true },
    { id: 'desc', label: 'Describe the work', type: 'textarea' },
    { id: 'photos', label: 'Photos or attachments', type: 'photos' },
    { id: 'where', label: 'Location', type: 'address', required: true,
      alt: { id: 'remote', label: 'This can be done remotely', type: 'check' } },
    { id: 'deadline', label: 'Preferred date or deadline', type: 'date' },
    { id: 'urgency', label: 'Urgency', type: 'select',
      options: ['Emergency — today if possible', 'Within a few days', 'This week is fine', 'Next couple of weeks', 'Just gathering quotes'] },
    { id: 'recurrence', label: 'Is this one-time or recurring?', type: 'select',
      options: ['One-time', 'Recurring — weekly', 'Recurring — biweekly', 'Recurring — monthly', 'Not sure yet'] },
    { id: 'budget', label: 'Budget', type: 'money-range', optional: true },
  ],
  sell: [
    { id: 'title', label: 'What are you selling?', type: 'text', required: true },
    { id: 'desc', label: 'Describe it', type: 'textarea' },
    { id: 'photos', label: 'Photos', type: 'photos', encouraged: true },
    { id: 'condition', label: 'Condition', type: 'select', required: true,
      options: ['New / unused', 'Like new', 'Good', 'Fair', 'Needs repair', 'For parts or scrap'] },
    { id: 'quantity', label: 'Quantity', type: 'number', default: 1 },
    { id: 'lot', label: 'Is this a bulk lot?', type: 'select',
      options: ['Single item', 'Several items', 'Bulk lot', 'Entire household contents', 'Business inventory'] },
    { id: 'asking', label: 'Asking price', type: 'money',
      alt: { id: 'open-to-offers', label: 'Open to offers', type: 'check' } },
    { id: 'where', label: 'Location', type: 'address', required: true },
    { id: 'handover', label: 'Pickup or delivery', type: 'multi',
      options: ['Buyer picks up', 'I can deliver', 'Needs freight / haulage'] },
    { id: 'deadline', label: 'Selling deadline', type: 'date' },
  ],
  buy: [
    { id: 'title', label: 'What are you looking for?', type: 'text', required: true },
    { id: 'desc', label: 'Describe it', type: 'textarea' },
    { id: 'budget', label: 'Target price or maximum budget', type: 'money', required: true },
    { id: 'budget-includes', label: 'Does that budget include…', type: 'multi',
      options: ['Delivery', 'Installation', 'Tax and fees'] },
    { id: 'condition-ok', label: 'Acceptable condition', type: 'multi', required: true,
      options: ['New', 'Refurbished', 'Used', 'Any'] },
    { id: 'must-have', label: 'Required specifications', type: 'textarea',
      hint: 'Hard requirements. A response that misses these is flagged as an alternative, not a match.' },
    { id: 'nice-to-have', label: 'Preferences', type: 'textarea', optional: true,
      hint: 'Nice to have, but will not disqualify an offer.' },
    { id: 'alternatives', label: 'Would you consider alternatives?', type: 'select',
      options: ['Yes, show me options', 'Only if close', 'No — exactly what I described'] },
    { id: 'quantity', label: 'Quantity', type: 'number', default: 1 },
    { id: 'where', label: 'Location and delivery', type: 'address', required: true },
    { id: 'deadline', label: 'Purchase deadline', type: 'date' },
    { id: 'readiness', label: 'How ready are you to buy?', type: 'select',
      options: ['Ready now — cash in hand', 'Ready this week', 'Within the month', 'Researching prices'] },
  ],
};

/** Category-specific additions, keyed by parent category id then flag type. */
export const EXTRA_FIELDS = {
  'item.cars': {
    '*': [
      { id: 'make', label: 'Make and model', type: 'text' },
      { id: 'year', label: 'Year', type: 'text' },
      { id: 'mileage', label: 'Mileage', type: 'number' },
      { id: 'title-status', label: 'Title status', type: 'select',
        options: ['Clean', 'Salvage / rebuilt', 'Lien on title', 'Not sure'] },
    ],
    sell: [{ id: 'vin', label: 'VIN', type: 'text', optional: true }],
    buy: [{ id: 'max-mileage', label: 'Maximum mileage', type: 'number' }],
  },
  'item.damaged-vehicles': {
    '*': [
      { id: 'make', label: 'Make and model', type: 'text' },
      { id: 'year', label: 'Year', type: 'text' },
      { id: 'runs', label: 'Does it run and drive?', type: 'select', options: ['Runs and drives', 'Starts but will not drive', 'Does not start'] },
      { id: 'damage', label: 'Damage', type: 'textarea' },
    ],
  },
  'item.computers': {
    '*': [
      { id: 'device', label: 'Device type', type: 'text' },
      { id: 'model', label: 'Model', type: 'text' },
      { id: 'storage', label: 'Storage', type: 'text' },
      { id: 'unlocked', label: 'Carrier locked?', type: 'select', options: ['Unlocked', 'Locked', 'Not applicable'] },
    ],
  },
  'item.appliances': {
    '*': [
      { id: 'appliance', label: 'Appliance type', type: 'text' },
      { id: 'brand', label: 'Brand', type: 'text' },
      { id: 'dimensions', label: 'Dimensions', type: 'text' },
      { id: 'working', label: 'Is it working?', type: 'select', options: ['Fully working', 'Partly working', 'Not working'] },
    ],
  },
  'item.furniture': {
    '*': [
      { id: 'piece', label: 'Type of piece', type: 'text' },
      { id: 'dimensions', label: 'Dimensions', type: 'text' },
      { id: 'material', label: 'Material', type: 'text' },
    ],
  },
  'item.building-materials': {
    '*': [
      { id: 'material', label: 'Material', type: 'text' },
      { id: 'dimensions', label: 'Dimensions required', type: 'text' },
      { id: 'finish', label: 'Finish', type: 'text' },
      { id: 'qty-unit', label: 'Quantity unit', type: 'select', options: ['Pieces', 'Slabs', 'Square feet', 'Linear feet', 'Pallets'] },
    ],
  },
  'item.estate': {
    '*': [
      { id: 'rooms', label: 'How much is there?', type: 'select',
        options: ['One room', 'Part of a home', 'Whole home', 'Home plus garage / storage', 'Commercial premises'] },
      { id: 'access', label: 'Access notes', type: 'textarea', optional: true },
    ],
  },
  'svc.hvac': {
    service: [
      { id: 'system-age', label: 'How old is the system?', type: 'text', optional: true },
      { id: 'symptom', label: 'What is it doing?', type: 'text', optional: true },
    ],
  },
  'svc.moving': {
    service: [
      { id: 'size', label: 'Size of the move', type: 'select',
        options: ['Studio', '1 bedroom', '2 bedroom', '3+ bedroom', 'Single item', 'Office'] },
      { id: 'from-to', label: 'Moving from / to', type: 'text' },
      { id: 'stairs', label: 'Stairs or elevator?', type: 'select', options: ['Ground floor both ends', 'Stairs', 'Elevator', 'Mixed'] },
    ],
  },
};

/** Fields to render for a category + flag type, base first then category-specific. */
export function fieldsFor(categoryId, type) {
  const parent = parentOf(categoryId);
  const base = BASE_FIELDS[type] || BASE_FIELDS.service;
  const extra = (parent && EXTRA_FIELDS[parent.id]) || {};
  return base.concat(extra['*'] || [], extra[type] || []);
}

/* ================================================================ response shape
 * What a business must supply when answering, per flag type. Used to build the
 * response form and to decide whether an answer is a match or an alternative.
 */
export const RESPONSE_FIELDS = {
  service: [
    { id: 'price', label: 'Your price', type: 'money', required: true },
    { id: 'pricing-basis', label: 'Is this a fixed quote?', type: 'select', required: true,
      options: ['Fixed quote', 'Estimate — may change after inspection', 'Inspection required before quoting'] },
    { id: 'covers', label: 'What it covers', type: 'textarea' },
    { id: 'availability', label: 'Earliest availability', type: 'text' },
  ],
  sell: [
    { id: 'price', label: 'Your purchase offer', type: 'money', required: true },
    { id: 'offer-basis', label: 'What kind of offer is this?', type: 'select', required: true,
      options: ['Direct purchase — I am buying it', 'Consignment — I sell it for you', 'Brokerage — I find a buyer', 'Liquidation service'] },
    { id: 'collection', label: 'Collection', type: 'select', options: ['I collect', 'You deliver', 'Either'] },
    { id: 'conditions', label: 'Conditions', type: 'textarea', optional: true },
  ],
  buy: [
    { id: 'item-desc', label: 'The actual item you are offering', type: 'textarea', required: true },
    { id: 'photos', label: 'Photos of the actual item', type: 'photos', required: true },
    { id: 'specs', label: 'Condition and specifications', type: 'textarea', required: true },
    { id: 'price', label: 'Price', type: 'money', required: true },
    { id: 'delivery-cost', label: 'Delivery cost', type: 'money', optional: true },
    { id: 'install-cost', label: 'Installation cost', type: 'money', optional: true },
    { id: 'availability', label: 'Availability', type: 'text', required: true },
    { id: 'meets', label: 'Which requirements does it meet?', type: 'textarea', required: true },
    { id: 'deviations', label: 'Any deviations from what was asked', type: 'textarea',
      hint: 'Be explicit. Over-budget or off-spec offers are shown to the buyer as alternatives, not matches.' },
  ],
};

/** True when a buy-response is within budget and claims no deviations. */
export function classifyBuyResponse(flag, response) {
  const budget = Number(flag.budgetMax || flag.budget || 0);
  const total = Number(response.price || 0) +
                Number(response['delivery-cost'] || 0) +
                Number(response['install-cost'] || 0);
  const overBudget = budget > 0 && total > budget;
  const hasDeviations = !!String(response.deviations || '').trim();
  return {
    total,
    overBudget,
    hasDeviations,
    kind: overBudget || hasDeviations ? 'alternative' : 'match',
    reasons: [
      overBudget ? `${fmtOver(total, budget)} over budget` : null,
      hasDeviations ? 'Differs from the stated requirements' : null,
    ].filter(Boolean),
  };
}
const fmtOver = (total, budget) => '$' + Math.round(total - budget).toLocaleString('en-US');
