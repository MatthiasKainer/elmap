
    interface Shards {
        total: number;
        successful: number;
        failed: number;
    }

    interface Source {
        vertical: string;
        "@version": number;
        version: string;
        container_name: string;
        serviceName: string;
        timestamp: string;
        id: string;
        HOSTNAME: string;
        level: string;
        _id: string;
        "@hostname": string;
        created: string;
        "@vertical": string;
        message: string;
        "@timestamp": Date;
        source: string;
        pod_name: string;
        logger_name: string;
        forwarder: string;
        "@service-name": string;
        container_id: string;
        [key: string]: any;
    }

    interface Fields {
        timestamp: any[];
        "@timestamp": any[];
    }

    interface Highlight {
        message: string[];
        service: string[];
        "@service-name": string[];
    }

    interface Hit {
        _index: string;
        _type: string;
        _id: string;
        _score?: any;
        _source: Source;
        fields: Fields;
        highlight: Highlight;
        sort: any[];
    }

    interface Hits {
        total: number;
        max_score?: any;
        hits: Hit[];
    }

    export interface ElasticResult {
        took: number;
        timed_out: boolean;
        _shards: Shards;
        hits: Hits;
    }
