/**
 * Seed Script — generates 200,000 products in batches.
 *
 * Why batches?
 * Inserting one row at a time means 200,000 round-trips to the DB.
 * Batching with createMany() sends far fewer queries, each inserting
 * many rows at once, which is dramatically faster (minutes vs hours).
 *
 * Batch size of 2,000 is a safe middle ground:
 * - Large enough to be efficient
 * - Small enough to avoid hitting Postgres parameter limits (~65,535)
 *   (each row has 5 params → 2000 × 5 = 10,000 params per query — safely under the limit)
 */

const { PrismaClient } = require("@prisma/client");
const { v4: uuidv4 } = require("uuid");

const prisma = new PrismaClient();

const CATEGORIES = [
  "Electronics", "Books", "Clothing", "Home", "Sports",
  "Beauty", "Toys", "Automotive", "Garden", "Food & Grocery",
  "Health", "Music", "Office", "Pets", "Travel",
];
const TOTAL_PRODUCTS = 200_000;
const BATCH_SIZE = 2_000;

// Realistic product name prefixes per category
const PRODUCT_NAMES = {
  Electronics: [
    "Wireless Headphones", "Smart Watch", "Bluetooth Speaker", "Laptop Stand",
    "USB-C Hub", "Mechanical Keyboard", "Gaming Mouse", "4K Monitor", "Webcam", "SSD Drive",
    "Smart TV", "Noise Cancelling Earbuds", "Portable Charger", "LED Strip Lights", "Action Camera",
  ],
  Books: [
    "The Art of Code", "System Design Primer", "Clean Architecture", "Deep Work",
    "Atomic Habits", "The Pragmatic Programmer", "Designing Data-Intensive Applications",
    "Zero to One", "The Lean Startup", "Thinking Fast and Slow",
    "Rich Dad Poor Dad", "Sapiens", "The Psychology of Money", "Can't Hurt Me", "Ikigai",
  ],
  Clothing: [
    "Merino Wool Sweater", "Running Shorts", "Denim Jacket", "Yoga Pants",
    "Compression Socks", "Hiking Boots", "Waterproof Jacket", "Slim Fit Chinos",
    "Polo Shirt", "Fleece Hoodie", "Cargo Pants", "Graphic Tee", "Linen Shirt",
    "Puffer Vest", "Ankle Boots",
  ],
  Home: [
    "Bamboo Cutting Board", "Cast Iron Skillet", "Memory Foam Pillow", "LED Desk Lamp",
    "Air Purifier", "Coffee Grinder", "French Press", "Weighted Blanket", "Plant Stand",
    "Diffuser", "Robot Vacuum", "Blackout Curtains", "Scented Candle Set",
    "Non-stick Pan Set", "Towel Set",
  ],
  Sports: [
    "Resistance Bands", "Foam Roller", "Jump Rope", "Adjustable Dumbbells",
    "Yoga Mat", "Pull-up Bar", "Water Bottle", "Gym Bag", "Heart Rate Monitor",
    "Knee Sleeves", "Treadmill", "Cycling Gloves", "Protein Shaker", "Running Belt", "Swim Goggles",
  ],
  Beauty: [
    "Vitamin C Serum", "Hydrating Face Mask", "Retinol Moisturizer", "Micellar Water",
    "Foundation Brush Set", "Eyeshadow Palette", "Matte Lipstick", "Nail Polish Kit",
    "SPF 50 Sunscreen", "Rose Water Toner", "Lip Gloss Set", "BB Cream", "Setting Powder",
    "Under Eye Patches", "Hair Serum",
  ],
  Toys: [
    "LEGO Architecture Set", "Remote Control Car", "Strategy Board Game", "1000pc Jigsaw Puzzle",
    "Superhero Action Figure", "Plush Teddy Bear", "Science Experiment Kit", "Kinetic Sand Set",
    "Mini Drone Kit", "Card Game Pack", "Building Blocks Set", "Doll House", "Magnetic Tiles",
    "Foam Dart Blaster", "Wooden Train Set",
  ],
  Automotive: [
    "Magnetic Car Phone Mount", "Full HD Dash Cam", "Digital Tire Pressure Gauge",
    "Handheld Car Vacuum", "Leather Seat Covers", "Portable Jump Starter",
    "Car Air Purifier", "OBD2 Diagnostic Scanner", "Steering Wheel Cover",
    "All-Weather Floor Mats", "Car LED Interior Lights", "Windshield Sun Shade",
    "Roof Cargo Carrier", "Blind Spot Mirrors", "Car First Aid Kit",
  ],
  Garden: [
    "Raised Garden Bed Kit", "Expandable Garden Hose", "Bypass Pruning Shears",
    "Premium Potting Mix", "Copper Watering Can", "Slow-Release Plant Fertilizer",
    "Nitrile Garden Gloves", "3-Piece Trowel Set", "Hanging Bird Feeder",
    "Solar Garden Path Lights", "Compost Bin", "Seed Starter Tray", "Kneeling Pad",
    "Weed Barrier Fabric", "Plant Labels Pack",
  ],
  "Food & Grocery": [
    "Single Origin Coffee Beans", "Whey Protein Powder", "Extra Virgin Olive Oil",
    "Raw Wildflower Honey", "Mixed Nut Granola Bars", "Japanese Matcha Tea",
    "Almond Butter", "Organic Pasta Pack", "Ghost Pepper Hot Sauce", "Dark Chocolate 85%",
    "Quinoa", "Oat Milk", "Greek Yogurt", "Coconut Oil", "Avocado Spread",
  ],
  Health: [
    "Vitamin D3 + K2", "Omega-3 Fish Oil Capsules", "Multi-Strain Probiotics",
    "Melatonin Gummies", "Collagen Peptides Powder", "Digital Blood Pressure Monitor",
    "Fingertip Pulse Oximeter", "Smart Thermometer", "Complete First Aid Kit",
    "Percussion Massage Gun", "Compression Knee Brace", "Posture Corrector",
    "Electric Toothbrush", "Tongue Scraper", "Sleep Eye Mask",
  ],
  Music: [
    "Acoustic Guitar", "61-Key MIDI Keyboard", "Electronic Drum Pad",
    "USB Audio Interface", "Studio Monitor Headphones", "Condenser Microphone",
    "Guitar Pick Variety Pack", "Adjustable Guitar Capo", "Folding Sheet Music Stand",
    "Ukulele Starter Pack", "Bass Guitar", "Violin", "Harmonica",
    "Digital Metronome", "Guitar Effect Pedal",
  ],
  Office: [
    "Anti-Fatigue Standing Mat", "Dual Monitor Arm", "Cable Management Box",
    "Mesh Desk Organizer", "Wireless Qi Charger Pad", "Lumbar Support Cushion",
    "Glass Dry-Erase Board", "Undated Daily Planner", "Premium Ballpoint Pen Set",
    "Heavy-Duty Stapler", "Adjustable Laptop Stand", "Webcam with Ring Light",
    "Noise Machine", "Desk Calendar", "Sticky Note Assortment",
  ],
  Pets: [
    "Adjustable Dog Harness", "Interactive Cat Toy Pack", "Orthopedic Pet Bed",
    "Automatic Pet Feeder", "Reflective Dog Collar", "Clumping Cat Litter",
    "Professional Grooming Kit", "20-Gallon Aquarium Starter Kit", "Parakeet Bird Cage",
    "Soft-Sided Pet Carrier", "Dog Dental Chews", "Catnip Spray",
    "Retractable Dog Leash", "Pet Stain Remover", "Bird Seed Mix",
  ],
  Travel: [
    "6-Piece Packing Cubes Set", "Ergonomic Travel Pillow", "RFID Passport Holder",
    "Luggage Scale", "Bluetooth Noise Cancelling Earbuds", "Universal Travel Adapter",
    "Flight Compression Socks", "TSA-Approved Toiletry Bag", "20000mAh Power Bank",
    "Compact Travel Umbrella", "Packable Down Jacket", "Luggage Tags", "Travel Wallet",
    "Mini Padlock Set", "Microfiber Travel Towel",
  ],
};

/**
 * Generate a random product object.
 * Spreads updatedAt across the past 2 years to simulate real data distribution.
 */
function generateProduct(index) {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const names = PRODUCT_NAMES[category];
  const baseName = names[Math.floor(Math.random() * names.length)];

  // Spread records over the past ~2 years (in milliseconds)
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
  const randomOffset = Math.floor(Math.random() * twoYearsMs);
  const updatedAt = new Date(Date.now() - randomOffset);
  // createdAt is always ≤ updatedAt
  const createdAt = new Date(
    updatedAt.getTime() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)
  );

  return {
    id: uuidv4(),
    name: `${baseName} #${index + 1}`,
    category,
    price: parseFloat((Math.random() * 990 + 10).toFixed(2)), // $10–$1000
    createdAt,
    updatedAt,
  };
}

async function main() {
  console.log(`🌱 Starting seed: ${TOTAL_PRODUCTS.toLocaleString()} products`);
  console.log(`   Batch size: ${BATCH_SIZE.toLocaleString()}`);
  console.log(
    `   Total batches: ${Math.ceil(TOTAL_PRODUCTS / BATCH_SIZE).toLocaleString()}\n`
  );

  // Clear existing products so seed is idempotent
  console.log("🗑️  Clearing existing products...");
  await prisma.product.deleteMany();

  const startTime = Date.now();
  let inserted = 0;

  for (let batchStart = 0; batchStart < TOTAL_PRODUCTS; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_PRODUCTS);
    const batch = [];

    for (let i = batchStart; i < batchEnd; i++) {
      batch.push(generateProduct(i));
    }

    // createMany sends a single INSERT ... VALUES (...),(...),(...)
    // which is far more efficient than individual inserts
    await prisma.product.createMany({ data: batch });

    inserted += batch.length;
    const pct = ((inserted / TOTAL_PRODUCTS) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(
      `\r   Progress: ${inserted.toLocaleString()} / ${TOTAL_PRODUCTS.toLocaleString()} (${pct}%) — ${elapsed}s elapsed`
    );
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n✅ Seed complete: ${inserted.toLocaleString()} products in ${totalTime}s`);
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
