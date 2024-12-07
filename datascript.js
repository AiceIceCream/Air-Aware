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
    `;

    if (filteredData.length === 0) {
        const noResultsDiv = document.createElement('div');
        noResultsDiv.textContent = `No locations found with "${remarkInput}" remarks${selectedDate ? ` on ${new Date(selectedDate).toLocaleDateString()}` : ''}.`;
        resultContainer.appendChild(noResultsDiv);
    } else {
        const remarkCounts = {};

        // Count remarks by location name using locationNames map
        filteredData.forEach(item => {
            const locationName = locationNames[item.locationId] || `Unknown (${item.locationId})`;
            remarkCounts[locationName] = (remarkCounts[locationName] || 0) + 1;
        });

        // Sort locations by count in descending order
        const sortedLocations = Object.entries(remarkCounts).sort((a, b) => b[1] - a[1]);

        // Add each location and its remark count to the container
        sortedLocations.forEach(([locationName, count]) => {
            const div = document.createElement('div');
            div.textContent = `${locationName}: ${count} ${remarkInput} remarks`;
            resultContainer.appendChild(div);
        });
    }

    // Add remarks table at the bottom
    const remarksTable = `
        <table class="remarks-table" style="margin-top: 20px; width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="border: 1px solid #ccc; padding: 10px;">Remarks</th>
                    <th style="border: 1px solid #ccc; padding: 10px;">Description</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="background-color: #14bb00; color: white; border: 1px solid #ccc; padding: 10px;">Good</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">People are okay to roam outdoors.</td>
                </tr>
                <tr>
                    <td style="background-color: #f9c71d; color: white; border: 1px solid #ccc; padding: 10px;">Fair</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">People are okay to roam outdoors with caution.</td>
                </tr>
                <tr>
                    <td style="background-color: #fdb114; color: white; border: 1px solid #ccc; padding: 10px;">Unhealthy</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">People with respiratory disease, such as asthma, should limit outdoor exertion.</td>
                </tr>
                <tr>
                    <td style="background-color: red; color: white; border: 1px solid #ccc; padding: 10px;">Very Unhealthy</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">
                        Pedestrians should avoid heavy traffic areas. People with heart or respiratory disease, such as asthma, 
                        should stay indoors and rest as much as possible. Unnecessary trips should be postponed. 
                        People should voluntarily restrict the use of vehicles.
                    </td>
                </tr>
                <tr>
                    <td style="background-color: purple; color: white; border: 1px solid #ccc; padding: 10px;">Severely Unhealthy</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">
                        Pedestrians should avoid heavy traffic areas. People with heart or respiratory disease, such as asthma, 
                        should stay indoors and rest as much as possible. Unnecessary trips should be postponed. 
                        Motor vehicle use may be restricted. Industrial activities may be curtailed.
                    </td>
                </tr>
                <tr>
                    <td style="background-color: maroon; color: white; border: 1px solid #ccc; padding: 10px;">Emergency</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">
                        Everyone should remain indoors (keeping windows and doors closed). Motor vehicle use should be 
                        prohibited except for emergency situations. Industrial activities, except that which is vital for 
                        public safety and health, should be curtailed.
                    </td>
                </tr>
            </tbody>
        </table>
    `;

    resultContainer.innerHTML += remarksTable;

    // Show the result container
    showResultContainer();

    // Attach event listener for closing the container
    document.getElementById('closeResultContainer').addEventListener('click', hideResultContainer);
}
