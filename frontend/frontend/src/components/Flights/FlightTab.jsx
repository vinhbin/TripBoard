import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function FlightTab({ trip }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useState({
    origin: '',
    destination: '',
    adults: 1,
    travelClass: 'ECONOMY',
  });
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [originHint, setOriginHint] = useState('');
  const [destHint, setDestHint] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    setSearchParams((prev) => ({
      ...prev,
      destination: trip.destination.split(',')[0].trim(),
    }));
  }, [trip]);

  const handleInputChange = (e) => {
    setSearchParams({ ...searchParams, [e.target.name]: e.target.value });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFlights([]);
    try {
      const { data } = await api.post('/flights/search', {
        origin: searchParams.origin,
        destination: searchParams.destination,
        departureDate: trip.startDate.split('T')[0],
        returnDate: trip.endDate.split('T')[0],
        adults: parseInt(searchParams.adults, 10),
        travelClass: searchParams.travelClass,
      });
      setFlights(data.flights || []);
      if (!data.flights?.length) {
        setError('No flights found for these dates. Try adjusting your search.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to search flights. Please try again.');
      console.error('Flight search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (field) => {
    const value = searchParams[field];
    if (!value || value.length < 3) {
      setError('Enter at least 3 characters to detect nearest airport');
      return;
    }
    setLookupLoading(true);
    setError('');
    try {
      const { data } = await api.get('/flights/lookup', { params: { query: value } });
      const hint = `${data.airport.code} — ${data.airport.name} (${data.airport.city}) • ${data.airport.distanceKm} km`;
      if (field === 'origin') {
        setOriginHint(`Nearest: ${hint}`);
        setSearchParams((prev) => ({ ...prev, origin: data.airport.code }));
      } else {
        setDestHint(`Nearest: ${hint}`);
        setSearchParams((prev) => ({ ...prev, destination: data.airport.code }));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to find nearest airport');
    } finally {
      setLookupLoading(false);
    }
  };

  const formatDuration = (duration) => {
    const hours = duration.match(/(\d+)H/)?.[1] || 0;
    const minutes = duration.match(/(\d+)M/)?.[1] || 0;
    return `${hours}h ${minutes}m`;
  };

  const formatTime = (datetime) =>
    new Date(datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (datetime) =>
    new Date(datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const handleBookFlight = (flight) => {
    setSelectedFlight(flight);
    window.open(flight.bookingLink || '#', '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg shadow-md p-6 border border-transparent dark:border-slate-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">✈️ Search Flights</h3>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                From (Origin Airport) *
              </label>
              <input
                type="text"
                name="origin"
                value={searchParams.origin}
                onChange={handleInputChange}
                placeholder="e.g., ATL (Atlanta)"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleLookup('origin')}
                  disabled={lookupLoading}
                  className="px-3 py-1 text-xs bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800"
                >
                  {lookupLoading ? 'Detecting…' : 'Detect nearest airport'}
                </button>
                {originHint && (
                  <span className="text-xs text-gray-600 dark:text-slate-300">{originHint}</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                To (Destination) *
              </label>
              <input
                type="text"
                name="destination"
                value={searchParams.destination}
                onChange={handleInputChange}
                placeholder="e.g., CDG (Paris)"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleLookup('destination')}
                  disabled={lookupLoading}
                  className="px-3 py-1 text-xs bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800"
                >
                  {lookupLoading ? 'Detecting…' : 'Detect nearest airport'}
                </button>
                {destHint && <span className="text-xs text-gray-600 dark:text-slate-300">{destHint}</span>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                Passengers
              </label>
              <input
                type="number"
                name="adults"
                value={searchParams.adults}
                onChange={handleInputChange}
                min="1"
                max="9"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                Travel Class
              </label>
              <select
                name="travelClass"
                value={searchParams.travelClass}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="ECONOMY">Economy</option>
                <option value="PREMIUM_ECONOMY">Premium Economy</option>
                <option value="BUSINESS">Business</option>
                <option value="FIRST">First Class</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-slate-900 dark:border-slate-700 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800 dark:text-slate-200">
                <strong>Travel Dates:</strong> {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                <br />
                Searching round-trip flights for these dates
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Searching flights...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Flights
              </>
            )}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {flights.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
              Found {flights.length} flight{flights.length !== 1 ? 's' : ''}
            </h3>
            <div className="text-sm text-gray-600 dark:text-slate-300">
              Round-trip • {searchParams.adults} passenger{searchParams.adults !== 1 ? 's' : ''}
            </div>
          </div>

          {flights.map((flight, index) => (
            <div
              key={index}
              className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg shadow-md hover:shadow-lg transition p-6 border border-transparent dark:border-slate-700"
            >
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">Outbound</span>
                </div>
                {flight.itineraries[0].segments.map((segment, idx) => (
                  <div key={idx} className="flex items-center gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                            {formatTime(segment.departure.at)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-slate-300">
                            {segment.departure.iataCode}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400">
                            {formatDate(segment.departure.at)}
                          </div>
                        </div>
                        <div className="flex-1 px-4 text-center">
                          <div className="text-sm text-gray-600 dark:text-slate-300 mb-1">
                            {formatDuration(segment.duration)}
                          </div>
                          <div className="h-0.5 bg-gray-300 dark:bg-slate-700 relative">
                            <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                              </svg>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                            {segment.numberOfStops === 0
                              ? 'Direct'
                              : `${segment.numberOfStops} stop${segment.numberOfStops > 1 ? 's' : ''}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                            {formatTime(segment.arrival.at)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-slate-300">{segment.arrival.iataCode}</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400">{formatDate(segment.arrival.at)}</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-300 mt-2">
                        {segment.carrierCode} {segment.number} • {segment.aircraft?.code || 'Aircraft info N/A'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {flight.itineraries[1] && (
                <div className="border-t dark:border-slate-700 pt-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-blue-600 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span className="font-semibold text-gray-900 dark:text-slate-100">Return</span>
                  </div>
                  {flight.itineraries[1].segments.map((segment, idx) => (
                    <div key={idx} className="flex items-center gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                              {formatTime(segment.departure.at)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-slate-300">{segment.departure.iataCode}</div>
                            <div className="text-xs text-gray-500 dark:text-slate-400">{formatDate(segment.departure.at)}</div>
                          </div>
                          <div className="flex-1 px-4 text-center">
                            <div className="text-sm text-gray-600 dark:text-slate-300 mb-1">
                              {formatDuration(segment.duration)}
                            </div>
                            <div className="h-0.5 bg-gray-300 dark:bg-slate-700 relative">
                              <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                </svg>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                              {segment.numberOfStops === 0
                                ? 'Direct'
                                : `${segment.numberOfStops} stop${segment.numberOfStops > 1 ? 's' : ''}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                              {formatTime(segment.arrival.at)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-slate-300">{segment.arrival.iataCode}</div>
                            <div className="text-xs text-gray-500 dark:text-slate-400">{formatDate(segment.arrival.at)}</div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-slate-300 mt-2">
                          {segment.carrierCode} {segment.number} • {segment.aircraft?.code || 'Aircraft info N/A'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t dark:border-slate-700 pt-4 flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-slate-100">
                    ${flight.price.total}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-300">
                    {flight.price.currency} • Total for {searchParams.adults} passenger
                    {searchParams.adults !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleBookFlight(flight)}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Select Flight
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && flights.length === 0 && !error && (
        <div className="text-center py-12 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg shadow-md border border-transparent dark:border-slate-700">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">Search for Flights</h3>
          <p className="text-gray-600 dark:text-slate-300">Enter your origin airport to find available flights</p>
        </div>
      )}
    </div>
  );
}
