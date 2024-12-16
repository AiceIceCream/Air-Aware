const sensorsApiUrl = "https://kohjcrdirmvamsjcefew.supabase.co/rest/v1/sensors";
const locationsApiUrl = "https://kohjcrdirmvamsjcefew.supabase.co/rest/v1/locations";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvaGpjcmRpcm12YW1zamNlZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjczMzA2MTMsImV4cCI6MjA0MjkwNjYxM30.nuysQR2UPTch2YbRDPYWAgp14Ofi73gL72T9j6JIDM4";

const rowsPerPage = 50;
let currentPage = 1;
let data = [];
let locationNames = {};

const cache = {
    locationNames: null,
    sensorData: null,
};

async function fetchData() {

    if (cache.sensorData) {
        console.log("Using cached sensor data");
        return cache.sensorData;
    }

    let allData = [];
    let from = 0;
    const batchSize = 1000;
    let to = batchSize - 1;
    let hasMoreData = true;

    while (hasMoreData) {
        const { data: batchData, error } = await supabase
            .from('sensors')
            .select('*')
            .range(from, to)
            .order('date', { ascending: false });

        if (error) {
            console.error("Error fetching data:", error.message);
            break;
        }

        if (batchData.length === 0) {
            hasMoreData = false;
        } else {
            allData = allData.concat(batchData);
            from += batchSize;
            to += batchSize;
        }
    }
    cache.sensorData = allData; // Cache data
    return allData;
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await fetchLocations();

        data = await fetchData();

        renderPage();

        document.getElementById('exportButton').addEventListener('click', () => {
            const selectedDate = document.getElementById('datePicker').value;
            exportToExcel(data, selectedDate);
        });
    } catch (error) {
        console.error('Error loading data:', error);
    }
});

async function fetchLocations() {
    if (cache.locationNames) {
        console.log("Using cached locations");
        return cache.locationNames;
    }

    const locationsResponse = await fetch(locationsApiUrl, {
        method: 'GET',
        headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    });

    if (!locationsResponse.ok) {
        throw new Error(`Locations fetch error: ${locationsResponse.statusText}`);
    }

    const locations = await locationsResponse.json();

    locations.forEach(location => {
        locationNames[location.locationId] = location.location;
    });

    cache.locationNames = locationNames
    return locationNames;
}

function renderPage() {
    const table = document.getElementById('dataTable');
    const pageDisplay = document.getElementById('pageDisplay');

    table.querySelectorAll("tr:not(:first-child)").forEach(row => row.remove());

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = data.slice(start, end);

    pageData.forEach((row, index) => {
        const tr = document.createElement('tr');
        const locationName = locationNames[row.locationId] || row.locationId;

        tr.innerHTML = `
                    <td>${start + index + 1}</td>
                    <td>${formatTimestamp(row.date)}</td>
                    <td>${locationName}</td>
                    <td>${row.pm25}</td>
                    <td>${row.pm25Remarks}</td>
                    <td>${row.pm10}</td>
                    <td>${row.pm10Remarks}</td>
                    <td>${row.humidity}</td>
                    <td>${row.humidityRemarks}</td>
                    <td>${row.temperature}</td>
                    <td>${row.temperatureRemarks}</td>
                    <td>${row.oxygen}</td>
                    <td>${row.oxygenRemarks}</td>
                `;
        table.appendChild(tr);
    });

    pageDisplay.textContent = `Page ${currentPage} of ${Math.ceil(data.length / rowsPerPage)}`;
}



function nextPage() {
    if (currentPage * rowsPerPage < data.length) {
        currentPage++;
        renderPage();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderPage();
    }
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}





function exportToExcel(data, selectedDate) {
    const selectedDateObj = selectedDate ? new Date(selectedDate) : new Date();
    selectedDateObj.setHours(0, 0, 0, 0);

    const filteredData = data.filter(item => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        return itemDate.getTime() === selectedDateObj.getTime();
    });

    if (filteredData.length === 0) {
        alert('No data available for the selected date.');
        return;
    }

    const calculatePollutantOverallRemark = (data, pollutantKey) => {
        const remarkCounts = {};

        data.forEach(item => {
            const remark = item[`${pollutantKey}Remarks`];
            if (remark) {
                remarkCounts[remark] = (remarkCounts[remark] || 0) + 1;
            }
        });

        // Get the most frequent remark
        return Object.keys(remarkCounts).reduce((a, b) =>
            remarkCounts[a] > remarkCounts[b] ? a : b, "Unknown"
        );
    };

    const pm25OverallRemark = calculatePollutantOverallRemark(filteredData, "pm25");
    const pm10OverallRemark = calculatePollutantOverallRemark(filteredData, "pm10");
    const humidityOverallRemark = calculatePollutantOverallRemark(filteredData, "humidity");
    const temperatureOverallRemark = calculatePollutantOverallRemark(filteredData, "temperature");
    const oxygenOverallRemark = calculatePollutantOverallRemark(filteredData, "oxygen");

    const excelData = filteredData.map(item => ({
        id: item.id,
        date: new Date(item.date).toLocaleString(),
        locationId: item.locationId,
        pm25: item.pm25,
        pm25Remarks: item.pm25Remarks,
        pm10: item.pm10,
        pm10Remarks: item.pm10Remarks,
        humidity: item.humidity,
        humidityRemarks: item.humidityRemarks,
        temperature: item.temperature,
        temperatureRemarks: item.temperatureRemarks,
        oxygen: item.oxygen,
        oxygenRemarks: item.oxygenRemarks,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData, {
        header: [
            "id",
            "date",
            "locationId",
            "pm25",
            "pm25Remarks",
            "pm10",
            "pm10Remarks",
            "humidity",
            "humidityRemarks",
            "temperature",
            "temperatureRemarks",
            "oxygen",
            "oxygenRemarks",
        ],
    });

    XLSX.utils.sheet_add_aoa(worksheet, [
        ["Overall Remarks"],
        ["PM2.5", pm25OverallRemark],
        ["PM10", pm10OverallRemark],
        ["Humidity", humidityOverallRemark],
        ["Temperature", temperatureOverallRemark],
        ["Oxygen", oxygenOverallRemark],
    ], { origin: `Q1` });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Particulate Matter Data');

    XLSX.writeFile(workbook, `AirQuality_${selectedDateObj.toLocaleDateString()}.xlsx`);
}


///For the Search Engine
function showResultContainer() {
    const resultContainer = document.getElementById('resultContainer');
    resultContainer.style.display = 'block';
}

function hideResultContainer() {
    const resultContainer = document.getElementById('resultContainer');
    resultContainer.style.display = 'none';
}

function filterLocations() {
    const remarkInput = document.getElementById('remarkInput').value.trim().toLowerCase(); 
    const selectedDate = document.getElementById('datePicker').value;

    if (!remarkInput) {
        alert('Please enter a remark (e.g., Good, Poor, Unhealthy, etc.)');
        return;
    }

    let filteredData = data.filter(item =>
        ['pm25Remarks', 'pm10Remarks', 'humidityRemarks', 'temperatureRemarks', 'oxygenRemarks'].some(remarkType =>
            item[remarkType]?.toLowerCase() === remarkInput
        )
    );

    if (selectedDate) {
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);

        filteredData = filteredData.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= startDate && itemDate <= endDate;
        });
    }

    displaySearchResults(filteredData, remarkInput, selectedDate);
}

function displaySearchResults(filteredData, remarkInput, selectedDate) {
    const resultContainer = document.getElementById('resultContainer');
    resultContainer.innerHTML = `
        <button id="closeResultContainer">&times;</button>
        <div id="selectedDate" style="font-weight: bold; margin-bottom: 10px;">
            Results for: ${selectedDate ? new Date(selectedDate).toLocaleDateString() : 'All Dates'}
        </div>
        <div id="remarkHeader" style="font-weight: bold; margin-bottom: 10px; font-size: 1.2em;">
            Remark: "${remarkInput}"
        </div>
    `;

    if (filteredData.length === 0) {
        const noResultsDiv = document.createElement('div');
        noResultsDiv.textContent = `No locations found with "${remarkInput}" remarks${selectedDate ? ` on ${new Date(selectedDate).toLocaleDateString()}` : ''}.`;
        resultContainer.appendChild(noResultsDiv);
    } else {
        // Create a map to store counts for each location
        const locationRemarkCounts = {};
        const overallCounts = { PM2_5: 0, PM10: 0, Temperature: 0, Humidity: 0, Oxygen: 0 };

        // Populate locationRemarkCounts and overallCounts with initial values
        filteredData.forEach(item => {
            const locationName = locationNames[item.locationId] || `Unknown (${item.locationId})`;

            if (!locationRemarkCounts[locationName]) {
                locationRemarkCounts[locationName] = { PM2_5: 0, PM10: 0, Temperature: 0, Humidity: 0, Oxygen: 0 };
            }

            if (item.pm25Remarks?.toLowerCase() === remarkInput.toLowerCase()) {
                locationRemarkCounts[locationName].PM2_5++;
                overallCounts.PM2_5++;
            }
            if (item.pm10Remarks?.toLowerCase() === remarkInput.toLowerCase()) {
                locationRemarkCounts[locationName].PM10++;
                overallCounts.PM10++;
            }
            if (item.temperatureRemarks?.toLowerCase() === remarkInput.toLowerCase()) {
                locationRemarkCounts[locationName].Temperature++;
                overallCounts.Temperature++;
            }
            if (item.humidityRemarks?.toLowerCase() === remarkInput.toLowerCase()) {
                locationRemarkCounts[locationName].Humidity++;
                overallCounts.Humidity++;
            }
            if (item.oxygenRemarks?.toLowerCase() === remarkInput.toLowerCase()) {
                locationRemarkCounts[locationName].Oxygen++;
                overallCounts.Oxygen++;
            }
        });

        // Function to get cautionary statement based on the remark
        function getCautionaryStatement(remark) {
            console.log("Cautionary statement for remark:", remark);  // Debugging line
            if (remark === "good")
                return "Safe air levels, Humidity is in Comfortable range, Safe temperature levels, Safe oxygen levels; no action needed.";
            if (remark === "fair")
                return "Some pollutants may be a concern for sensitive individuals, Dry or Humid conditions monitor hydration levels and consider humidification, Sligt Discomfort and may feel sticky.";
            if (remark === "unhealthy")
                return "People with respiratory disease, such as asthma, should limit outdoor exertion.";
            if (remark === "very unhealthy")
                return "Pedestrians should avoid heavy traffic areas. People with heart or respiratory disease such as asthma should stay indoors and rest as much as possible. Unnecessary trips should be postponed. People should voluntarily restrict the use of vehicles.";
            if (remark === "acutely unhealthy")
                return "Pedestrians should avoid heavy traffic areas. People with heart or respiratory disease such as asthma should stay indoors and rest as much as possible. Unnecessary trips should be postponed. Motor vehicle use may be restricted. Industrial activities may be curtailed.";
            if (remark === "poor")
                return "Excessively dry; potential for skin irritation and dehydration. Use humidifiers or Excessively humid; risk of mold growth and discomfort. Use dehumidifiers.";
            if (remark === "emergency")
                return "Everyone should remain indoors (keeping windows and doors closed). Motor vehicle use should be prohibited except for emergency situations. Industrial activities, except that which is vital for public safety and health, should be curtailed.";
            if (remark === "danger ")
                return "Avoid outdoor activities; risk of heat-related illnesses."
            if (remark === "extreme")
                return "Severe risk: Stay indoors; heatstroke possible."
            if (remark === "low")
                return "Risk of hypoxia; ensure oxygen supply and ventilation."
            else
                return "No cautionary statement available.";
        }

        // Generate the table dynamically
        let tableHTML = `
            <table class="results-table" style="margin-top: 20px; width: 100%; border-collapse: collapse; text-align: center;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #ccc; padding: 10px;">Location</th>
                        <th style="border: 1px solid #ccc; padding: 10px;">PM2.5</th>
                        <th style="border: 1px solid #ccc; padding: 10px;">PM10</th>
                        <th style="border: 1px solid #ccc; padding: 10px;">Temperature</th>
                        <th style="border: 1px solid #ccc; padding: 10px;">Humidity</th>
                        <th style="border: 1px solid #ccc; padding: 10px;">Oxygen</th>
                        <th style="border: 1px solid #ccc; padding: 10px;">Total Remarks</th>
                        <th style="border: 1px solid #ccc; padding: 10px;">Cautionary Statement</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Populate the rows with data and total remarks count
        Object.entries(locationRemarkCounts).forEach(([locationName, counts]) => {
            const totalRemarks = counts.PM2_5 + counts.PM10 + counts.Temperature + counts.Humidity + counts.Oxygen;
            const cautionaryStatement = getCautionaryStatement(remarkInput);

            tableHTML += `
                <tr>
                    <td style="border: 1px solid #ccc; padding: 10px;">${locationName}</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">${counts.PM2_5}</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">${counts.PM10}</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">${counts.Temperature}</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">${counts.Humidity}</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">${counts.Oxygen}</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">${totalRemarks}</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">${cautionaryStatement}</td>
                </tr>
            `;
        });

        resultContainer.innerHTML += tableHTML;
    }
    // Show the result container
    showResultContainer();

    // Attach event listener for closing the container
    document.getElementById('closeResultContainer').addEventListener('click', hideResultContainer);
}