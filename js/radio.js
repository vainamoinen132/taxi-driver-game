// ============================================================
// RADIO STATIONS SYSTEM - Music and news for immersion
// ============================================================

class RadioSystem {
    constructor() {
        this.currentStation = 0;
        this.volume = 0.3;
        this.enabled = false;
        this.newsTimer = 0;
        this.newsInterval = 45; // News every 45 seconds
        this.currentNews = null;
        this.stationTimer = 0;
        this.stationChangeInterval = 180; // Change station content every 3 minutes
        
        // Radio stations with procedural content
        this.stations = [
            {
                id: 'jazz',
                name: 'Jazz FM 92.5',
                genre: 'Jazz',
                color: '#8B4513',
                description: 'Smooth jazz and blues',
                songs: this._generateJazzSongs(),
                ads: this._generateAds(),
                newsPriority: 'low'
            },
            {
                id: 'rock',
                name: 'Rock Radio 101.3',
                genre: 'Rock',
                color: '#DC143C',
                description: 'Classic and modern rock',
                songs: this._generateRockSongs(),
                ads: this._generateAds(),
                newsPriority: 'medium'
            },
            {
                id: 'lofi',
                name: 'Lo-Fi Beats',
                genre: 'Lo-Fi',
                color: '#9370DB',
                description: 'Relaxing study beats',
                songs: this._generateLoFiSongs(),
                ads: this._generateAds(),
                newsPriority: 'low'
            },
            {
                id: 'news',
                name: 'City News 98.7',
                genre: 'News/Talk',
                color: '#4169E1',
                description: '24/7 news and traffic',
                songs: [],
                ads: this._generateAds(),
                newsPriority: 'high',
                newsSegments: this._generateNewsSegments()
            }
        ];
        
        this.currentSong = null;
        this.songTimer = 0;
        this.lastNewsTime = 0;
    }

    _generateJazzSongs() {
        const artists = ['Miles Davis Quartet', 'John Coltrane', 'Bill Evans Trio', 'Thelonious Monk', 'Charles Mingus'];
        const adjectives = ['Smooth', 'Blue', 'Midnight', 'Cool', 'Velvet', 'Golden'];
        const nouns = ['Moon', 'Street', 'Club', 'Night', 'Journey', 'Dream'];
        
        const songs = [];
        for (let i = 0; i < 20; i++) {
            songs.push({
                title: `${randChoice(adjectives)} ${randChoice(nouns)}`,
                artist: randChoice(artists),
                duration: 180 + Math.random() * 120, // 3-5 minutes
                mood: 'relaxing'
            });
        }
        return songs;
    }

    _generateRockSongs() {
        const artists = ['The Thunderbirds', 'Steel Heart', 'Neon Dreams', 'Midnight Riders', 'Electric Storm'];
        const adjectives = ['Breaking', 'Highway', 'Last', 'Wild', 'Electric', 'Heavy'];
        const nouns = ['Dawn', 'Road', 'Chance', 'Fire', 'Storm', 'Metal'];
        
        const songs = [];
        for (let i = 0; i < 20; i++) {
            songs.push({
                title: `${randChoice(adjectives)} ${randChoice(nouns)}`,
                artist: randChoice(artists),
                duration: 150 + Math.random() * 150, // 2.5-4 minutes
                mood: 'energetic'
            });
        }
        return songs;
    }

    _generateLoFiSongs() {
        const artists = ['Chillhop Producer', 'Study Beats', 'Rainy Day Music', 'Coffee Shop Vibes', 'Late Night Lo-Fi'];
        const adjectives = ['Study', 'Rain', 'Coffee', 'Night', 'Peaceful', 'Focus'];
        const nouns = ['Session', 'Beats', 'Mix', 'Vibes', 'Sounds', 'Flow'];
        
        const songs = [];
        for (let i = 0; i < 15; i++) {
            songs.push({
                title: `${randChoice(adjectives)} ${randChoice(nouns)}`,
                artist: randChoice(artists),
                duration: 120 + Math.random() * 180, // 2-5 minutes
                mood: 'relaxing'
            });
        }
        return songs;
    }

    _generateAds() {
        const products = [
            'Super Fuel Plus - Get 20% more mileage!',
            'Marty\'s Auto Repair - We fix anything!',
            'City Insurance - Protect your taxi today!',
            'Comfort Seats - Drive in luxury!',
            'GPS Navigator Pro - Never get lost!',
            'Energy Drinks - Stay awake on night shifts!',
            'Car Wash Express - Shine bright!',
            'Taxi Driver Academy - Better tips guaranteed!'
        ];
        
        const ads = [];
        for (const product of products) {
            ads.push({
                text: product,
                duration: 15 + Math.random() * 10
            });
        }
        return ads;
    }

    _generateNewsSegments() {
        return [
            'Breaking: Traffic congestion reported downtown during rush hour',
            'Weather: Clear skies expected throughout the day',
            'City Council announces new taxi regulations next month',
            'Economy: Gas prices expected to rise by 5% this week',
            'Sports: Local team wins championship in dramatic fashion',
            'Traffic: Accident on Highway 101 cleared, delays easing',
            'Business: New ride-sharing app launches in the city',
            'Community: Annual taxi driver convention this weekend',
            'Weather: Rain expected tomorrow evening',
            'Police: Speed enforcement increased in school zones'
        ];
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this._startNewContent();
        }
        return this.enabled;
    }

    changeStation(direction = 1) {
        this.currentStation = (this.currentStation + direction + this.stations.length) % this.stations.length;
        this._startNewContent();
        return this.getCurrentStationInfo();
    }

    getCurrentStationInfo() {
        const station = this.stations[this.currentStation];
        return {
            name: station.name,
            genre: station.genre,
            color: station.color,
            enabled: this.enabled
        };
    }

    getCurrentContent() {
        if (!this.enabled) return null;
        
        const station = this.stations[this.currentStation];
        
        if (station.id === 'news') {
            return {
                type: 'news',
                text: this.currentNews || 'Welcome to City News 98.7',
                station: station.name,
                color: station.color
            };
        } else if (this.currentSong) {
            return {
                type: 'music',
                title: this.currentSong.title,
                artist: this.currentSong.artist,
                station: station.name,
                color: station.color,
                mood: this.currentSong.mood
            };
        }
        
        return null;
    }

    update(dt) {
        if (!this.enabled) return;
        
        const station = this.stations[this.currentStation];
        
        // Update station content timer
        this.stationTimer += dt;
        if (this.stationTimer >= this.stationChangeInterval) {
            this._startNewContent();
            this.stationTimer = 0;
        }
        
        // Update song timer
        if (this.currentSong && station.id !== 'news') {
            this.songTimer += dt;
            if (this.songTimer >= this.currentSong.duration) {
                this._playNextSong();
            }
        }
        
        // Update news timer
        this.newsTimer += dt;
        if (this.newsTimer >= this.newsInterval) {
            this._playNewsSegment();
            this.newsTimer = 0;
        }
    }

    _startNewContent() {
        const station = this.stations[this.currentStation];
        
        if (station.id === 'news') {
            this.currentNews = randChoice(station.newsSegments);
            this.currentSong = null;
        } else if (station.songs.length > 0) {
            this._playNextSong();
        }
    }

    _playNextSong() {
        const station = this.stations[this.currentStation];
        if (station.songs.length > 0) {
            this.currentSong = randChoice(station.songs);
            this.songTimer = 0;
            this.currentNews = null;
        }
    }

    _playNewsSegment() {
        const station = this.stations[this.currentStation];
        
        // Only play news on stations with news priority
        if (station.newsPriority !== 'none' && Math.random() < this._getNewsChance(station.newsPriority)) {
            if (station.id === 'news') {
                this.currentNews = randChoice(station.newsSegments);
            } else {
                // Brief news update on music stations
                const newsSegments = [
                    'Traffic update: Heavy traffic on Main Street',
                    'Weather: Clear skies ahead',
                    'Quick news: City events this weekend'
                ];
                this.currentNews = randChoice(newsSegments);
                setTimeout(() => {
                    this.currentNews = null;
                }, 10000); // Brief news segment
            }
        }
    }

    _getNewsChance(priority) {
        switch (priority) {
            case 'high': return 1.0;
            case 'medium': return 0.6;
            case 'low': return 0.3;
            default: return 0.2;
        }
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    getVolume() {
        return this.volume;
    }
}
