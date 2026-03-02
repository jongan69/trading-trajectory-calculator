let chart = null;

function toggleCalculationMode() {
    const mode = document.getElementById('calculationMode').value;
    const initialCapitalGroup = document.getElementById('initialCapitalGroup');
    const targetAmountGroup = document.getElementById('targetAmountGroup');
    const calculateBtn = document.getElementById('calculateBtn');

    if (mode === 'forward') {
        initialCapitalGroup.style.display = 'block';
        targetAmountGroup.style.display = 'none';
        calculateBtn.textContent = 'Calculate Trajectory';
    } else {
        initialCapitalGroup.style.display = 'none';
        targetAmountGroup.style.display = 'block';
        calculateBtn.textContent = 'Find Requirements';
    }

    calculate();
}

function calculate() {
    const mode = document.getElementById('calculationMode').value;

    if (mode === 'forward') {
        calculateTrajectory();
    } else {
        calculateReverseRequirements();
    }
}

function calculateTrajectory() {
    const initialCapital = parseFloat(document.getElementById('initialCapital').value);
    const avgReward = parseFloat(document.getElementById('avgReward').value) / 100;
    const tradeFrequency = parseInt(document.getElementById('tradeFrequency').value);
    const timePeriod = document.getElementById('timePeriod').value;
    const duration = parseInt(document.getElementById('duration').value);
    const volatility = parseFloat(document.getElementById('volatility').value) / 100;
    const compounding = document.getElementById('compounding').value === 'true';

    if (initialCapital <= 0) {
        alert('Initial capital must be greater than 0');
        return;
    }

    const trajectory = simulateTrajectory({
        initialCapital,
        avgReward,
        tradeFrequency,
        timePeriod,
        duration,
        volatility,
        compounding
    });

    updateResults(trajectory);
    updateChart(trajectory);

    document.getElementById('results').style.display = 'block';
}

function calculateReverseRequirements() {
    const targetAmount = parseFloat(document.getElementById('targetAmount').value);
    const avgReward = parseFloat(document.getElementById('avgReward').value) / 100;
    const tradeFrequency = parseInt(document.getElementById('tradeFrequency').value);
    const timePeriod = document.getElementById('timePeriod').value;
    const duration = parseInt(document.getElementById('duration').value);
    const volatility = parseFloat(document.getElementById('volatility').value) / 100;
    const compounding = document.getElementById('compounding').value === 'true';

    if (targetAmount <= 0) {
        alert('Target amount must be greater than 0');
        return;
    }

    if (avgReward <= 0 && compounding) {
        alert('Average reward must be positive for compounding growth to reach target');
        return;
    }

    const reverseResults = calculateRequiredInitialCapital({
        targetAmount,
        avgReward,
        tradeFrequency,
        timePeriod,
        duration,
        volatility,
        compounding
    });

    updateReverseResults(reverseResults);
    updateChart(reverseResults);

    document.getElementById('results').style.display = 'block';
}

function calculateRequiredInitialCapital(params) {
    const {
        targetAmount,
        avgReward,
        tradeFrequency,
        timePeriod,
        duration,
        volatility,
        compounding
    } = params;

    const periodsPerYear = getPeriodMultiplier(timePeriod);
    const totalTrades = tradeFrequency * duration;

    let requiredInitial;

    if (compounding) {
        // For compounding, use the compound growth formula
        // Final = Initial * (1 + r)^n, where r is average return per trade
        const compoundMultiplier = Math.pow(1 + avgReward, totalTrades);
        requiredInitial = targetAmount / compoundMultiplier;
    } else {
        // For non-compounding, gains are linear based on initial capital
        // Final = Initial + (Initial * r * n)
        // Target = Initial * (1 + r * totalTrades)
        const linearMultiplier = 1 + (avgReward * totalTrades);
        requiredInitial = targetAmount / linearMultiplier;
    }

    // Generate trajectory using the calculated initial capital
    const trajectory = simulateTrajectory({
        initialCapital: requiredInitial,
        avgReward,
        tradeFrequency,
        timePeriod,
        duration,
        volatility,
        compounding
    });

    // Calculate what's achievable with different initial amounts
    const alternatives = [];
    const amounts = [1000, 5000, 10000, 25000, 50000, 100000];

    amounts.forEach(amount => {
        if (amount < targetAmount) {
            const result = simulateTrajectory({
                initialCapital: amount,
                avgReward,
                tradeFrequency,
                timePeriod,
                duration,
                volatility,
                compounding
            });
            alternatives.push({
                initial: amount,
                final: result.finalNetWorth,
                percentOfTarget: (result.finalNetWorth / targetAmount) * 100
            });
        }
    });

    return {
        ...trajectory,
        requiredInitial,
        targetAmount,
        totalTrades,
        alternatives,
        periodsPerYear
    };
}

function simulateTrajectory(params) {
    const {
        initialCapital,
        avgReward,
        tradeFrequency,
        timePeriod,
        duration,
        volatility,
        compounding
    } = params;

    const periodsPerYear = getPeriodMultiplier(timePeriod);
    const totalTrades = tradeFrequency * duration;
    const dataPoints = Math.min(duration * 10, 500); // Limit chart points for performance
    const tradesPerDataPoint = totalTrades / dataPoints;

    let netWorth = initialCapital;
    const trajectory = [{
        period: 0,
        netWorth: initialCapital,
        trades: 0
    }];

    for (let i = 1; i <= dataPoints; i++) {
        const tradesAtThisPoint = Math.floor(i * tradesPerDataPoint);
        const tradesToProcess = tradesAtThisPoint - trajectory[i - 1].trades;

        for (let trade = 0; trade < tradesToProcess; trade++) {
            const randomReturn = generateRandomReturn(avgReward, volatility);
            const positionSize = compounding ? netWorth : initialCapital;
            const tradeGain = positionSize * randomReturn;

            netWorth += tradeGain;

            // Prevent net worth from going negative
            netWorth = Math.max(0, netWorth);
        }

        const currentPeriod = (i / dataPoints) * duration;
        trajectory.push({
            period: currentPeriod,
            netWorth: netWorth,
            trades: tradesAtThisPoint
        });
    }

    return {
        trajectory,
        finalNetWorth: netWorth,
        totalReturn: ((netWorth - initialCapital) / initialCapital) * 100,
        annualizedReturn: calculateAnnualizedReturn(initialCapital, netWorth, duration, periodsPerYear),
        totalTrades,
        initialCapital
    };
}

function generateRandomReturn(avgReturn, volatility) {
    // Generate normally distributed random return using Box-Muller transformation
    const u = Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);

    return avgReturn + (volatility * z);
}

function getPeriodMultiplier(timePeriod) {
    const multipliers = {
        'week': 52,
        'month': 12,
        'quarter': 4,
        'year': 1
    };
    return multipliers[timePeriod];
}

function calculateAnnualizedReturn(initial, final, duration, periodsPerYear) {
    const years = duration / periodsPerYear;
    if (years <= 0 || initial <= 0) return 0;

    const totalReturn = final / initial;
    const annualized = (Math.pow(totalReturn, 1 / years) - 1) * 100;

    return isFinite(annualized) ? annualized : 0;
}

function updateResults(results) {
    const { finalNetWorth, totalReturn, annualizedReturn, totalTrades } = results;

    // Show forward calculation results
    document.getElementById('finalNetWorthStat').style.display = 'flex';
    document.getElementById('requiredInitialStat').style.display = 'none';
    document.getElementById('recommendationStat').style.display = 'none';

    document.getElementById('finalNetWorth').textContent = formatCurrency(finalNetWorth);
    document.getElementById('totalReturn').textContent = formatPercentage(totalReturn);
    document.getElementById('annualizedReturn').textContent = formatPercentage(annualizedReturn);
    document.getElementById('totalTrades').textContent = totalTrades.toLocaleString();
}

function updateReverseResults(results) {
    const {
        requiredInitial,
        targetAmount,
        totalReturn,
        annualizedReturn,
        totalTrades,
        alternatives
    } = results;

    // Show reverse calculation results
    document.getElementById('finalNetWorthStat').style.display = 'none';
    document.getElementById('requiredInitialStat').style.display = 'flex';
    document.getElementById('recommendationStat').style.display = 'flex';

    document.getElementById('requiredInitial').textContent = formatCurrency(requiredInitial);
    document.getElementById('totalReturn').textContent = formatPercentage(totalReturn);
    document.getElementById('annualizedReturn').textContent = formatPercentage(annualizedReturn);
    document.getElementById('totalTrades').textContent = totalTrades.toLocaleString();

    // Generate recommendation based on required amount
    let recommendation = '';
    if (requiredInitial > 100000) {
        recommendation = `Very high initial capital required. Consider: increasing trade frequency, improving win rate, or extending time period.`;
    } else if (requiredInitial > 50000) {
        recommendation = `High initial capital required. You might consider starting with less and targeting intermediate goals.`;
    } else if (requiredInitial > 10000) {
        recommendation = `Moderate initial capital required. This target seems achievable with consistent trading.`;
    } else {
        recommendation = `Low initial capital required. This target is very achievable with your current parameters.`;
    }

    // Add alternative suggestions
    if (alternatives.length > 0) {
        const bestAlternative = alternatives.reduce((best, current) =>
            current.percentOfTarget > best.percentOfTarget ? current : best
        );

        if (bestAlternative.percentOfTarget >= 50) {
            recommendation += ` Alternative: Start with ${formatCurrency(bestAlternative.initial)} to reach ${bestAlternative.percentOfTarget.toFixed(0)}% of your target.`;
        }
    }

    document.getElementById('recommendation').textContent = recommendation;
}

function updateChart(results) {
    const ctx = document.getElementById('trajectoryChart').getContext('2d');

    const timePeriod = document.getElementById('timePeriod').value;
    const periodLabel = timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1) + 's';
    const mode = document.getElementById('calculationMode').value;

    const datasets = [{
        label: 'Net Worth',
        data: results.trajectory.map(point => point.netWorth),
        borderColor: '#3498db',
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6
    }, {
        label: 'Initial Capital',
        data: results.trajectory.map(() => results.initialCapital),
        borderColor: '#95a5a6',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0
    }];

    // Add target line for reverse calculations
    if (mode === 'reverse' && results.targetAmount) {
        datasets.push({
            label: 'Target Amount',
            data: results.trajectory.map(() => results.targetAmount),
            borderColor: '#e74c3c',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [10, 5],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0
        });
    }

    const data = {
        labels: results.trajectory.map(point => point.period.toFixed(1)),
        datasets: datasets
    };

    const config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Trading Trajectory - Net Worth Over Time',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `Period: ${context[0].label} ${timePeriod}${context[0].label != 1 ? 's' : ''}`;
                        },
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                const point = results.trajectory[context.dataIndex];
                                return [
                                    `Net Worth: ${formatCurrency(context.parsed.y)}`,
                                    `Trades Completed: ${point.trades.toLocaleString()}`
                                ];
                            }
                            return `Initial Capital: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: periodLabel
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Net Worth ($)'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrencyShort(value);
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    };

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, config);
}

function formatCurrency(amount) {
    if (Math.abs(amount) >= 1000000) {
        return '$' + (amount / 1000000).toFixed(2) + 'M';
    } else if (Math.abs(amount) >= 1000) {
        return '$' + (amount / 1000).toFixed(1) + 'K';
    } else {
        return '$' + amount.toFixed(2);
    }
}

function formatCurrencyShort(amount) {
    if (Math.abs(amount) >= 1000000) {
        return '$' + (amount / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(amount) >= 1000) {
        return '$' + (amount / 1000).toFixed(0) + 'K';
    } else {
        return '$' + Math.round(amount);
    }
}

function formatPercentage(percent) {
    return (percent >= 0 ? '+' : '') + percent.toFixed(2) + '%';
}

// Initialize with default calculation on page load
document.addEventListener('DOMContentLoaded', function() {
    calculate();

    // Add real-time updates when inputs change
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('input', calculate);
        input.addEventListener('change', calculate);
    });
});