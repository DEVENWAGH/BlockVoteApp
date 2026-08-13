package com.blockvote.android.di

import com.blockvote.android.BuildConfig
import com.blockvote.android.data.remote.BlockVoteApi
import com.squareup.moshi.Moshi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object BlockVoteApiModule {
    @Provides
    @Singleton
    fun provideBlockVoteApi(client: OkHttpClient, moshi: Moshi): BlockVoteApi =
        BlockVoteApi(client, moshi, BuildConfig.API_BASE_URL)
}
