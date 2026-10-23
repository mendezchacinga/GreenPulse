const recoveredDestinations = ["Reciclaje", "Reventa", "Reutilización interna"];

function inRange(value, from, to) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    if (from && date < new Date(from)) return false;
    if (to && date > new Date(`${to}T23:59:59.999Z`)) return false;
    return true;
}

function weekKey(value) {
    const date = new Date(value);
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - day + 1);
    return date.toISOString().slice(0, 10);
}

function changePct(current, previous) {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / previous) * 100;
}

function sumKg(list) {
    return list.reduce((sum, item) => sum + Number(item.weight || 0), 0);
}

function disposalCost(list) {
    return list.filter((item) => item.destination === "Disposición final").reduce((sum, item) => sum + Number(item.cost || 0), 0);
}

function recoveredShare(list) {
    const total = sumKg(list);
    if (!total) return 0;
    return (sumKg(list.filter((item) => recoveredDestinations.includes(item.destination))) / total) * 100;
}

function previousRange(from, to) {
    const fromDate = new Date(from);
    const toDate = new Date(`${to}T23:59:59.999Z`);
    const duration = Math.max(toDate - fromDate, 86400000);
    const prevToDate = new Date(fromDate.getTime() - 1);
    const prevFromDate = new Date(prevToDate.getTime() - duration);
    return {
        prevFrom: prevFromDate.toISOString().slice(0, 10),
        prevTo: prevToDate.toISOString().slice(0, 10)
    };
}

function buildDashboardMetrics({ losses, production, dispatches, from, to, line = "" }) {
    const { prevFrom, prevTo } = previousRange(from, to);
    const validated = (item) => ["approved", "corrected"].includes(item.status);
    const matchLoss = (item, start, end) => validated(item) && inRange(item.occurredAt || item.createdAt, start, end) && (!line || item.line === line);
    const matchDispatch = (item, start, end) => inRange(item.occurredAt || item.createdAt, start, end);
    const matchProduction = (item, start, end) => inRange(item.date || item.createdAt, start, end) && (!line || item.line === line);
    const currentLosses = losses.filter((item) => matchLoss(item, from, to));
    const previousLosses = losses.filter((item) => matchLoss(item, prevFrom, prevTo));
    const currentDispatches = dispatches.filter((item) => matchDispatch(item, from, to));
    const previousDispatches = dispatches.filter((item) => matchDispatch(item, prevFrom, prevTo));
    const currentUnits = production.filter((item) => matchProduction(item, from, to)).reduce((sum, item) => sum + Number(item.units || 0), 0);
    const previousUnits = production.filter((item) => matchProduction(item, prevFrom, prevTo)).reduce((sum, item) => sum + Number(item.units || 0), 0);
    const totalLossKg = sumKg(currentLosses);
    const previousLossKg = sumKg(previousLosses);
    const currentCost = disposalCost(currentDispatches);
    const previousCost = disposalCost(previousDispatches);
    const recovered = recoveredShare(currentDispatches);
    const previousRecovered = recoveredShare(previousDispatches);
    const lossPerUnit = currentUnits ? totalLossKg / currentUnits : null;
    const previousLossPerUnit = previousUnits ? previousLossKg / previousUnits : null;
    const byLineMap = currentLosses.reduce((result, item) => {
        result[item.line || "Sin línea"] = (result[item.line || "Sin línea"] || 0) + Number(item.weight || 0);
        return result;
    }, {});
    const byLine = Object.entries(byLineMap).map(([name, weight]) => ({ name, weight })).sort((a, b) => b.weight - a.weight);
    const byWasteType = Object.entries(currentLosses.reduce((result, item) => {
        result[item.wasteType || "Sin tipo"] = (result[item.wasteType || "Sin tipo"] || 0) + Number(item.weight || 0);
        return result;
    }, {})).map(([name, weight]) => ({ name, weight })).sort((a, b) => b.weight - a.weight);
    const byWeekMap = {};
    currentLosses.forEach((item) => {
        const key = weekKey(item.occurredAt || item.createdAt);
        byWeekMap[key] = (byWeekMap[key] || 0) + Number(item.weight || 0);
    });
    const byWeek = Object.entries(byWeekMap).sort((a, b) => a[0].localeCompare(b[0])).map(([week, weight]) => ({ week, weight }));
    const weekAverage = byWeek.length ? byWeek.reduce((sum, item) => sum + item.weight, 0) / byWeek.length : 0;
    const byDestination = recoveredDestinations.concat(["Disposición final"]).map((name) => ({
        name,
        weight: sumKg(currentDispatches.filter((item) => item.destination === name))
    }));
    const destinationTotal = sumKg(byDestination);
    const byDestinationPct = byDestination.map((item) => ({
        ...item,
        pct: destinationTotal ? (item.weight / destinationTotal) * 100 : 0
    }));
    const lineValues = Object.values(byLineMap);
    const alerts = byLine.filter((item) => {
        const others = lineValues.filter((value) => value !== item.weight);
        if (!others.length) return false;
        const average = others.reduce((sum, value) => sum + value, 0) / others.length;
        return average > 0 && item.weight > average * 1.2;
    }).map((item) => {
        const others = lineValues.filter((value) => value !== item.weight);
        const average = others.reduce((sum, value) => sum + value, 0) / others.length;
        return { line: item.name, weight: item.weight, differencePct: ((item.weight - average) / average) * 100 };
    });
    return {
        from,
        to,
        empty: !currentLosses.length && !currentDispatches.length,
        kpis: {
            totalLossKg,
            totalLossChange: changePct(totalLossKg, previousLossKg),
            lossPerUnit,
            lossPerUnitChange: lossPerUnit == null || previousLossPerUnit == null ? null : changePct(lossPerUnit, previousLossPerUnit),
            disposalCost: currentCost,
            disposalCostChange: changePct(currentCost, previousCost),
            hasDisposalCost: currentDispatches.some((item) => item.destination === "Disposición final" && Number(item.cost || 0) > 0) || currentCost > 0,
            recoveredPct: recovered,
            recoveredChange: changePct(recovered, previousRecovered),
            pendingValidation: losses.filter((item) => item.status === "pending").length,
            topLine: byLine[0] || null
        },
        charts: { byLine, byWasteType, byWeek, byDestination: byDestinationPct, weekAverage },
        alerts
    };
}

module.exports = {
    recoveredDestinations,
    inRange,
    weekKey,
    changePct,
    buildDashboardMetrics
};
