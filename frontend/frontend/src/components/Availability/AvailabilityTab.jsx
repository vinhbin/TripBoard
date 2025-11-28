import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function AvailabilityTab({ trip }) {
  const { user } = useAuth();
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('can'); // can | maybe | cannot
  const [viewMode, setViewMode] = useState('my'); // my | group
  const MAX_DAYS = 90;

  const getCalendarDays = () => {
    const dates = [];
    const start = new Date(trip.startDate);
    const rawEnd = new Date(trip.endDate);
    const cappedEnd = new Date(start);
    cappedEnd.setDate(cappedEnd.getDate() + MAX_DAYS - 1);
    const end = rawEnd < cappedEnd ? rawEnd : cappedEnd;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  };

  useEffect(() => {
    fetchAvailabilities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip._id]);

  const fetchAvailabilities = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/trips/${trip._id}/availability`);
      setAvailabilities(data.availabilities);
    } catch (err) {
      console.error('Failed to fetch availabilities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (date, newStatus) => {
    setUpdating(true);
    try {
      const isoDate = date.toISOString().split('T')[0];

      if (newStatus === null) {
        await api.delete(`/trips/${trip._id}/availability`, { data: { date: isoDate } });
        setAvailabilities((prev) =>
          prev.filter(
            (a) =>
              !(
                new Date(a.date).toDateString() === date.toDateString() &&
                a.userId._id === user.id
              ),
          ),
        );
        return;
      }

      const { data } = await api.post(`/trips/${trip._id}/availability`, {
        date: isoDate,
        status: newStatus,
      });

      setAvailabilities((prev) => {
        const filtered = prev.filter(
          (a) =>
            !(
              new Date(a.date).toDateString() === date.toDateString() &&
              a.userId._id === user.id
            ),
        );
        return [...filtered, data.availability];
      });
    } catch (err) {
      console.error('Failed to update availability:', err);
      alert('Failed to update availability');
    } finally {
      setUpdating(false);
    }
  };

  const handleDateClick = async (date) => {
    // Click sets the selectedStatus; to clear, user can cycle to null by selecting none in UI if you add that option
    await handleStatusChange(date, selectedStatus);
  };

  const getDatesInRange = () => {
    const dates = [];
    const start = new Date(trip.startDate);
    const rawEnd = new Date(trip.endDate);
    const cappedEnd = new Date(start);
    cappedEnd.setDate(cappedEnd.getDate() + MAX_DAYS - 1);
    const end = rawEnd < cappedEnd ? rawEnd : cappedEnd;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  };

  const getUserStatus = (date) => {
    const availability = availabilities.find(
      (a) =>
        new Date(a.date).toDateString() === date.toDateString() && a.userId._id === user.id,
    );
    return availability?.status || null;
  };

  const getDateScore = (date) => {
    const dateAvails = availabilities.filter(
      (a) => new Date(a.date).toDateString() === date.toDateString(),
    );
    let score = 0;
    dateAvails.forEach((a) => {
      if (a.status === 'can') score += 3;
      else if (a.status === 'maybe') score += 1;
      else if (a.status === 'cannot') score -= 2;
    });
    return score;
  };

  const getDateStatuses = (date) =>
    trip.members.map((member) => {
      const availability = availabilities.find(
        (a) =>
          new Date(a.date).toDateString() === date.toDateString() &&
          a.userId._id === member._id,
      );
      return {
        member,
        status: availability?.status || null,
      };
    });

  const cycleStatus = (currentStatus) => {
    const cycle = [null, 'can', 'maybe', 'cannot'];
    const currentIndex = cycle.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % cycle.length;
    return cycle[nextIndex];
  };

  const getStatusColor = (status, isInRange) => {
    if (!isInRange) return 'bg-gray-100 text-gray-400';
    switch (status) {
      case 'can':
        return 'bg-green-500 text-white';
      case 'maybe':
        return 'bg-yellow-500 text-white';
      case 'cannot':
        return 'bg-red-500 text-white';
      default:
        return 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200';
    }
  };

  const getGroupHeatmapColor = (date) => {
    if (!isInTripRange(date)) return 'bg-gray-100 text-gray-400';
    const score = getDateScore(date);
    const memberCount = trip.members.length || 1;
    const maxScore = memberCount * 3; // all can
    if (score <= 0) return 'bg-red-100 text-red-800 border border-red-200';
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'bg-green-500 text-white';
    if (percentage >= 60) return 'bg-green-400 text-white';
    if (percentage >= 40) return 'bg-yellow-400 text-gray-900';
    if (percentage >= 20) return 'bg-yellow-300 text-gray-900';
    return 'bg-orange-300 text-gray-900';
  };

  const calendarDays = getCalendarDays();
  const monthsToShow = [];

  // group days by month
  let currentMonth = null;
  calendarDays.forEach((day) => {
    const monthKey = `${day.getFullYear()}-${day.getMonth()}`;
    if (monthKey !== currentMonth) {
      currentMonth = monthKey;
      monthsToShow.push({
        month: day.getMonth(),
        year: day.getFullYear(),
        days: [],
      });
    }
    monthsToShow[monthsToShow.length - 1].days.push(day);
  });

  // top dates
  const tripDates = calendarDays.filter(isInTripRange);
  const rankedDates = tripDates
    .map((date) => ({
      date,
      score: getDateScore(date),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const tripLengthDays =
    Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24)) + 1;

  if (loading) {
    return <div className="text-center py-8">Loading availability...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Instructions & Status selector */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-bold mb-3">Mark Your Availability</h3>
        <p className="mb-4 opacity-90">Pick a status, then click dates on the calendar.</p>
        {tripLengthDays > MAX_DAYS && (
          <div className="mb-3 text-sm bg-white/15 rounded-md px-3 py-2">
            Trip is {tripLengthDays} days long. Showing the first {MAX_DAYS} days for performance.
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {[
            { key: 'can', label: 'Can Go', icon: '✓', color: 'bg-green-600' },
            { key: 'maybe', label: 'Maybe', icon: '?', color: 'bg-yellow-500' },
            { key: 'cannot', label: 'Cannot', icon: '✗', color: 'bg-red-600' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelectedStatus(opt.key)}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${selectedStatus === opt.key ? `${opt.color} text-white ring-2 ring-white` : 'bg-white/20 text-white hover:bg-white/30'
                }`}
            >
              <span className="text-xl">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* View toggle */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Calendar View</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('my')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'my' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              My Availability
            </button>
            <button
              onClick={() => setViewMode('group')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'group' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Group Heatmap
            </button>
          </div>
        </div>
      </div>

      {/* Top dates */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🏆 Best Dates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rankedDates.map(({ date, score }, index) => (
            <div key={date.toISOString()} className="border-2 border-blue-200 rounded-lg p-4 text-center bg-blue-50">
              <div className="text-sm font-semibold text-blue-600 mb-1 flex items-center justify-center gap-1">
                {index === 0 && '🥇'}
                {index === 1 && '🥈'}
                {index === 2 && '🥉'}
                <span>#{index + 1}</span>
              </div>
              <div className="text-lg font-bold text-gray-900 mb-1">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="text-sm text-gray-600">
                {date.toLocaleDateString('en-US', { weekday: 'long' })}
              </div>
              <div className="mt-2 text-2xl font-bold text-blue-600">{score} pts</div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar months */}
      {monthsToShow.map((monthData) => {
        const monthName = new Date(monthData.year, monthData.month).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });
        const weeks = [];
        for (let i = 0; i < monthData.days.length; i += 7) {
          weeks.push(monthData.days.slice(i, i + 7));
        }

        return (
          <div key={`${monthData.year}-${monthData.month}`} className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{monthName}</h3>
            <div className="mb-4">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                    {day}
                  </div>
                ))}
              </div>
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="grid grid-cols-7 gap-2 mb-2">
                  {week.map((date) => {
                    const inRange = isInTripRange(date);
                    const userStatus = getUserStatus(date);
                    const isCurrentMonth = date.getMonth() === monthData.month;
                    const colorClass =
                      viewMode === 'my' ? getStatusColor(userStatus, inRange) : getGroupHeatmapColor(date);
                    const dateStatuses = getDateStatuses(date);

                    return (
                      <button
                        key={date.toISOString()}
                        onClick={() => inRange && handleDateClick(date)}
                        disabled={!inRange || updating}
                        className={`
                          relative aspect-square rounded-lg font-medium text-sm transition-all
                          ${colorClass}
                          ${!isCurrentMonth ? 'opacity-30' : ''}
                          ${inRange ? 'cursor-pointer transform hover:scale-105 shadow-sm' : 'cursor-not-allowed'}
                          ${!inRange && !isCurrentMonth ? 'invisible' : ''}
                          ${updating ? 'opacity-70' : ''}
                        `}
                        title={
                          inRange
                            ? `${date.toDateString()} - ${userStatus ? userStatus : 'Click to mark'}`
                            : 'Outside trip dates'
                        }
                      >
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-lg">{date.getDate()}</div>
                          {viewMode === 'group' && inRange && (
                            <div className="text-xs font-bold mt-1">{getDateScore(date)}</div>
                          )}
                        </div>

                        {/* Tooltip */}
                        {inRange && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                            <div className="bg-gray-900 text-white text-xs rounded p-2 whitespace-nowrap">
                              <div className="font-semibold mb-1">
                                {date.toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </div>
                              {dateStatuses.map(({ member, status }) => (
                                <div key={member._id} className="flex items-center gap-1">
                                  <div
                                    className={`w-2 h-2 rounded-full ${status === 'can'
                                        ? 'bg-green-400'
                                        : status === 'maybe'
                                          ? 'bg-yellow-400'
                                          : status === 'cannot'
                                            ? 'bg-red-400'
                                            : 'bg-gray-400'
                                      }`}
                                  />
                                  <span>{member.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Legend</h3>
        {viewMode === 'my' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-green-500 flex items-center justify-center text-white font-bold">✓</div>
              <span className="text-sm">Can Go</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-yellow-500 flex items-center justify-center text-white font-bold">?</div>
              <span className="text-sm">Maybe</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-red-500 flex items-center justify-center text-white font-bold">✗</div>
              <span className="text-sm">Cannot Go</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-white border-2 border-gray-300" />
              <span className="text-sm">Not Set</span>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-600">Worse</span>
              <div className="flex-1 h-8 rounded-lg overflow-hidden flex">
                <div className="flex-1 bg-red-100" />
                <div className="flex-1 bg-orange-300" />
                <div className="flex-1 bg-yellow-300" />
                <div className="flex-1 bg-yellow-400" />
                <div className="flex-1 bg-green-400" />
                <div className="flex-1 bg-green-500" />
              </div>
              <span className="text-sm text-gray-600">Better</span>
            </div>
            <p className="text-sm text-gray-600">Score: Can (+3) • Maybe (+1) • Cannot (-2)</p>
          </div>
        )}
      </div>
    </div>
  );
}
