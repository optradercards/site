// Sample card data for the marketplace
const sampleCards = [
    {
        id: 1,
        name: "Monkey D. Luffy",
        type: "Leader",
        rarity: "Super Rare",
        price: 45.99,
        power: 5000,
        attribute: "Strength",
        set: "Starter Deck",
        description: "The captain of the Straw Hat Pirates. A man who dreams of becoming the Pirate King."
    },
    {
        id: 2,
        name: "Roronoa Zoro",
        type: "Character",
        rarity: "Rare",
        price: 24.99,
        power: 4000,
        attribute: "Slash",
        set: "Booster Pack 01",
        description: "Swordsman of the Straw Hat Pirates. Master of the Three-Sword Style."
    },
    {
        id: 3,
        name: "Nami",
        type: "Character",
        rarity: "Uncommon",
        price: 12.99,
        power: 2000,
        attribute: "Special",
        set: "Booster Pack 01",
        description: "Navigator of the Straw Hat Pirates. Expert in weather manipulation."
    },
    {
        id: 4,
        name: "Sanji",
        type: "Character",
        rarity: "Rare",
        price: 19.99,
        power: 3500,
        attribute: "Strike",
        set: "Booster Pack 02",
        description: "Cook of the Straw Hat Pirates. Master of the Black Leg Style."
    },
    {
        id: 5,
        name: "Gum-Gum Red Hawk",
        type: "Event",
        rarity: "Super Rare",
        price: 34.99,
        power: null,
        attribute: "Strike",
        set: "Booster Pack 02",
        description: "A powerful Gear Second technique infused with Armament Haki."
    },
    {
        id: 6,
        name: "Thousand Sunny",
        type: "Stage",
        rarity: "Rare",
        price: 22.99,
        power: null,
        attribute: null,
        set: "Starter Deck",
        description: "The Straw Hat Pirates' second ship, designed and built by Franky."
    },
    {
        id: 7,
        name: "Portgas D. Ace",
        type: "Character",
        rarity: "Secret Rare",
        price: 89.99,
        power: 6000,
        attribute: "Special",
        set: "Booster Pack 03",
        description: "Luffy's sworn brother and former commander of the Whitebeard Pirates."
    },
    {
        id: 8,
        name: "Nico Robin",
        type: "Character",
        rarity: "Rare",
        price: 21.99,
        power: 3000,
        attribute: "Wisdom",
        set: "Booster Pack 01",
        description: "Archaeologist of the Straw Hat Pirates. User of the Flower-Flower Fruit."
    },
    {
        id: 9,
        name: "Shanks",
        type: "Leader",
        rarity: "Secret Rare",
        price: 125.99,
        power: 7000,
        attribute: "Wisdom",
        set: "Premium Pack",
        description: "One of the Four Emperors. The man who inspired Luffy to become a pirate."
    },
    {
        id: 10,
        name: "Tony Tony Chopper",
        type: "Character",
        rarity: "Common",
        price: 5.99,
        power: 1000,
        attribute: "Wisdom",
        set: "Starter Deck",
        description: "Doctor of the Straw Hat Pirates. A reindeer who ate the Human-Human Fruit."
    },
    {
        id: 11,
        name: "Brook",
        type: "Character",
        rarity: "Uncommon",
        price: 14.99,
        power: 2500,
        attribute: "Special",
        set: "Booster Pack 02",
        description: "Musician of the Straw Hat Pirates. A skeleton brought back to life."
    },
    {
        id: 12,
        name: "Jinbe",
        type: "Character",
        rarity: "Super Rare",
        price: 42.99,
        power: 5500,
        attribute: "Wisdom",
        set: "Booster Pack 03",
        description: "Helmsman of the Straw Hat Pirates. Former Warlord of the Sea."
    }
];

// User's collection data (stored in localStorage)
let userCollection = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadUserCollection();
    renderMarketplace();
    renderCollection();
    updateCollectionStats();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search and filter functionality
    document.getElementById('searchInput').addEventListener('input', filterMarketplace);
    document.getElementById('rarityFilter').addEventListener('change', filterMarketplace);
    document.getElementById('typeFilter').addEventListener('change', filterMarketplace);

    // Modal close functionality
    const modal = document.getElementById('cardModal');
    const closeBtn = document.querySelector('.close');
    
    closeBtn.onclick = function() {
        modal.style.display = 'none';
    }
    
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }

    // Navigation
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            navigateTo(targetId);
        });
    });
}

// Navigation function
function navigateTo(sectionId) {
    // Update active nav link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + sectionId) {
            link.classList.add('active');
        }
    });

    // Scroll to section
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// Render marketplace cards
function renderMarketplace(cards = sampleCards) {
    const cardGrid = document.getElementById('cardGrid');
    
    if (cards.length === 0) {
        cardGrid.innerHTML = '<div class="empty-state"><h3>No cards found</h3><p>Try adjusting your search or filters.</p></div>';
        return;
    }

    cardGrid.innerHTML = cards.map(card => `
        <div class="card-item" onclick="showCardDetails(${card.id})">
            <div class="card-image">
                ${card.name}
            </div>
            <div class="card-info">
                <div class="card-name">${card.name}</div>
                <div class="card-details">
                    <span class="rarity-badge rarity-${card.rarity.toLowerCase().replace(' ', '-')}">${card.rarity}</span>
                    <span>${card.type}</span>
                </div>
                ${card.power ? `<div class="card-details"><span>Power: ${card.power}</span></div>` : ''}
                <div class="card-price">$${card.price.toFixed(2)}</div>
                <div class="card-actions">
                    <button class="btn-buy" onclick="event.stopPropagation(); buyCard(${card.id})">Buy</button>
                    <button class="btn-trade" onclick="event.stopPropagation(); tradeCard(${card.id})">Trade</button>
                    <button class="btn-add" onclick="event.stopPropagation(); addToCollection(${card.id})">Add</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Filter marketplace cards
function filterMarketplace() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const rarityFilter = document.getElementById('rarityFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;

    const filteredCards = sampleCards.filter(card => {
        const matchesSearch = card.name.toLowerCase().includes(searchTerm) ||
                            card.description.toLowerCase().includes(searchTerm);
        const matchesRarity = !rarityFilter || card.rarity === rarityFilter;
        const matchesType = !typeFilter || card.type === typeFilter;
        
        return matchesSearch && matchesRarity && matchesType;
    });

    renderMarketplace(filteredCards);
}

// Show card details in modal
function showCardDetails(cardId) {
    const card = sampleCards.find(c => c.id === cardId);
    if (!card) return;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="modal-card-image">${card.name}</div>
        <div class="modal-card-details">
            <h3>${card.name}</h3>
            <p><strong>Type:</strong> ${card.type}</p>
            <p><strong>Rarity:</strong> <span class="rarity-badge rarity-${card.rarity.toLowerCase().replace(' ', '-')}">${card.rarity}</span></p>
            ${card.power ? `<p><strong>Power:</strong> ${card.power}</p>` : ''}
            ${card.attribute ? `<p><strong>Attribute:</strong> ${card.attribute}</p>` : ''}
            <p><strong>Set:</strong> ${card.set}</p>
            <div class="modal-card-description">
                <p><strong>Description:</strong></p>
                <p>${card.description}</p>
            </div>
            <p style="font-size: 1.5rem; color: var(--primary-color); font-weight: bold;">$${card.price.toFixed(2)}</p>
            <div class="card-actions">
                <button class="btn-buy" onclick="buyCard(${card.id})">Buy Now</button>
                <button class="btn-trade" onclick="tradeCard(${card.id})">Propose Trade</button>
                <button class="btn-add" onclick="addToCollection(${card.id})">Add to Collection</button>
            </div>
        </div>
    `;

    document.getElementById('cardModal').style.display = 'block';
}

// Card actions
function buyCard(cardId) {
    const card = sampleCards.find(c => c.id === cardId);
    alert(`Purchase initiated for ${card.name} at $${card.price.toFixed(2)}\n\nThis is a demo. In a real marketplace, this would process your payment.`);
}

function tradeCard(cardId) {
    const card = sampleCards.find(c => c.id === cardId);
    alert(`Trade proposal for ${card.name}\n\nThis is a demo. In a real marketplace, you would select cards from your collection to trade.`);
}

function addToCollection(cardId) {
    const card = sampleCards.find(c => c.id === cardId);
    if (!card) return;

    // Check if card already exists in collection
    const existingCard = userCollection.find(c => c.id === cardId);
    if (existingCard) {
        existingCard.quantity += 1;
    } else {
        userCollection.push({
            id: card.id,
            quantity: 1,
            dateAdded: new Date().toISOString()
        });
    }

    saveUserCollection();
    renderCollection();
    updateCollectionStats();
    alert(`${card.name} added to your collection!`);
}

// Load user collection from localStorage
function loadUserCollection() {
    const saved = localStorage.getItem('opTraderCollection');
    if (saved) {
        userCollection = JSON.parse(saved);
    }
}

// Save user collection to localStorage
function saveUserCollection() {
    localStorage.setItem('opTraderCollection', JSON.stringify(userCollection));
}

// Render user collection
function renderCollection() {
    const collectionGrid = document.getElementById('collectionGrid');
    
    if (userCollection.length === 0) {
        collectionGrid.innerHTML = '<div class="empty-state"><h3>Your collection is empty</h3><p>Start adding cards from the marketplace!</p></div>';
        return;
    }

    const collectionCards = userCollection.map(item => {
        const card = sampleCards.find(c => c.id === item.id);
        if (!card) return null;
        
        return {
            ...card,
            quantity: item.quantity,
            dateAdded: item.dateAdded
        };
    }).filter(card => card !== null);

    collectionGrid.innerHTML = collectionCards.map(card => `
        <div class="card-item" onclick="showCardDetails(${card.id})">
            <div class="card-image">
                ${card.name}
            </div>
            <div class="card-info">
                <div class="card-name">${card.name}</div>
                <div class="card-details">
                    <span class="rarity-badge rarity-${card.rarity.toLowerCase().replace(' ', '-')}">${card.rarity}</span>
                    <span>${card.type}</span>
                </div>
                ${card.power ? `<div class="card-details"><span>Power: ${card.power}</span></div>` : ''}
                <div class="card-details">
                    <span><strong>Quantity:</strong> ${card.quantity}</span>
                </div>
                <div class="card-price">$${card.price.toFixed(2)}</div>
            </div>
        </div>
    `).join('');
}

// Update collection statistics
function updateCollectionStats() {
    const totalCards = userCollection.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueCards = userCollection.length;
    const collectionValue = userCollection.reduce((sum, item) => {
        const card = sampleCards.find(c => c.id === item.id);
        return sum + (card ? card.price * item.quantity : 0);
    }, 0);

    document.getElementById('totalCards').textContent = totalCards;
    document.getElementById('uniqueCards').textContent = uniqueCards;
    document.getElementById('collectionValue').textContent = `$${collectionValue.toFixed(2)}`;
}
