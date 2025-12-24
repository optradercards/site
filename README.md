# OP Trader - One Piece TCG Marketplace

Welcome to **OP Trader**, a specialized marketplace for One Piece Trading Card Game collectors to buy, sell, and trade cards with enthusiasts worldwide.

## About

OP Trader is a modern web application built with Next.js, designed specifically for the One Piece Trading Card Game community. Whether you're a seasoned collector looking to complete your collection or a newcomer starting your journey in the Grand Line, OP Trader provides all the tools you need to manage and expand your card collection.

## Features

### 🏪 Marketplace
- **Browse Cards**: Explore a comprehensive catalog of One Piece TCG cards from various sets
- **Search & Filter**: Quickly find specific cards using search functionality and filters by rarity, type, and more
- **Card Details**: View detailed information about each card including power, attribute, rarity, and description
- **Buy, Sell, Trade**: Multiple options to acquire cards through purchase or trading

### 📚 Collection Management
- **Track Your Collection**: Maintain a digital inventory of all your cards
- **Collection Statistics**: View total cards, unique cards, and estimated collection value
- **Quantity Tracking**: Keep track of duplicate cards in your collection
- **Value Estimation**: See the current market value of your entire collection
- **Persistent Storage**: Collection data is saved locally in your browser

### 🎨 User Experience
- **Responsive Design**: Fully optimized for desktop, tablet, and mobile devices
- **Modern UI**: Clean interface built with Tailwind CSS
- **Real-time Updates**: Dynamic content updates with React state management
- **Modal Card Views**: Detailed card information in convenient popup windows
- **Smooth Navigation**: Seamless scrolling between sections

## Technology Stack

- **Next.js 15**: React framework for production with App Router
- **React 19**: Latest React with hooks and modern features
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **LocalStorage**: Client-side data persistence for collections

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm or yarn package manager

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/optradercards/site.git
   cd site
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Building for Production

To create an optimized production build:

```bash
npm run build
```

To run the production build locally:

```bash
npm start
```

## Project Structure

```
src/
├── app/                  # Next.js app directory
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout component
│   └── page.tsx         # Main homepage component
├── components/          # Reusable React components (if needed)
├── data/                # Static data files
│   └── sampleCards.ts   # Card database
├── hooks/               # Custom React hooks
│   └── useCollection.ts # Collection management hook
└── types/               # TypeScript type definitions
    └── card.ts          # Card type interfaces
```

## Usage

### Browsing the Marketplace
1. Navigate to the **Marketplace** section from the top navigation
2. Use the search box to find specific cards by name or description
3. Filter cards by rarity (Common, Uncommon, Rare, Super Rare, Secret Rare)
4. Filter cards by type (Character, Event, Stage, Leader)
5. Click on any card to view detailed information

### Managing Your Collection
1. Navigate to the **My Collection** section
2. View your collection statistics at the top
3. Browse all cards in your collection
4. Click on cards to view details

### Adding Cards to Collection
1. Browse the marketplace or use search to find a card
2. Click the **Add** button on any card
3. The card will be added to your collection
4. Your collection statistics will update automatically
5. Collection data persists across browser sessions

## Card Data

The marketplace currently includes sample cards featuring:
- Straw Hat Pirates crew members (Luffy, Zoro, Nami, Sanji, etc.)
- Legendary characters like Shanks and Portgas D. Ace
- Various card types (Leaders, Characters, Events, Stages)
- Multiple rarity levels (Common through Secret Rare)
- Cards from different sets (Starter Decks, Booster Packs, Premium Packs)

## Deployment

### Vercel (Recommended)

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com):

```bash
npm install -g vercel
vercel
```

### Other Platforms

You can also deploy to:
- **Netlify**: Connect your GitHub repo and deploy automatically
- **AWS Amplify**: Deploy with AWS infrastructure
- **Railway**: Deploy with a simple CLI
- **Docker**: Use the included Dockerfile for containerized deployment

## Browser Compatibility

OP Trader works on all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Opera (latest)

## Future Enhancements

Planned features for future releases:
- Backend API integration for real marketplace functionality
- User authentication and profiles
- Real-time trading system
- Price history and market trends
- Wishlist functionality
- Advanced deck building tools
- Community forums and chat
- Mobile app versions (React Native)
- Image uploads for cards
- Payment processing integration

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm start` - Run production server
- `npm run lint` - Run ESLint for code quality

### Adding New Cards

To add new cards to the marketplace, edit the `src/data/sampleCards.ts` file:

```typescript
{
  id: 13,
  name: "Card Name",
  type: "Character",
  rarity: "Rare",
  price: 19.99,
  power: 3000,
  attribute: "Strike",
  set: "Booster Pack 04",
  description: "Card description here."
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Disclaimer

One Piece is a trademark of Eiichiro Oda/Shueisha. This is a fan-made project and is not officially affiliated with or endorsed by Bandai, Shueisha, or any official One Piece Trading Card Game entities.

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

## Learn More

To learn more about Next.js and the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**OP Trader** - Sail the Grand Line of Card Trading! 🏴‍☠️
